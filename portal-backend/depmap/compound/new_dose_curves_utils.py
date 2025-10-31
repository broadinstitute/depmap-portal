from depmap.cell_line.models_new import DepmapModel
from depmap.compound.models import Compound, CompoundDoseReplicate, CompoundExperiment
from depmap.dataset.models import Dataset, DependencyDataset
from depmap.partials.matrix.models import Matrix
import pandas as pd


def get_dose_replicate_points(
    viabilities: list, compound_dose_replicates: list, model_id: str
):
    """
    Build a list of replicate points for a given model.
    Each point includes dose, viability, mask status, and replicate number.
    """

    # points only contains viability -- we need to add on dose, isMasked, and replicate ourselves
    assert len(compound_dose_replicates) == len(viabilities)

    points = []
    for i in range(len(viabilities)):
        if not pd.isna(viabilities[i]):
            points.append(
                {
                    "id": model_id,
                    "dose": compound_dose_replicates[i].dose,
                    "viability": viabilities[i],
                    "isMasked": compound_dose_replicates[i].is_masked,
                    "replicate": compound_dose_replicates[i].replicate,
                }
            )

    return points


def get_replicate_dataset_matrix(replicate_dataset_name: str) -> Matrix:
    # Get the replicate dataset, including viabilities. Do NOT use data_access here. data_access would not find the
    # legacy replicate datasets that have been filtered out of other places in the portal UI.
    replicate_dataset = Dataset.get_dataset_by_name(replicate_dataset_name)
    assert replicate_dataset is not None

    replicate_dataset_matrix = replicate_dataset.matrix

    return replicate_dataset_matrix


def _HACK_get_valid_depmap_ids(
    replicate_dataset_matrix: Matrix, compound_dose_replicates: list
) -> set:
    # HACK: This should not be necessary in production. But during development, my code
    # is using a hack that could result in curve_objs that are actually from the Repurposing
    # dataset, and not OncRef. We want to skip these curves.
    cell_line_series = replicate_dataset_matrix.get_cell_line_values_and_depmap_ids(
        compound_dose_replicates[0].entity_id
    )
    valid_depmap_ids = set(cell_line_series.index)

    return valid_depmap_ids


def _get_model_map(valid_depmap_ids: set) -> dict:
    model_objs = DepmapModel.query.filter(
        DepmapModel.model_id.in_(valid_depmap_ids)
    ).all()
    model_map = {m.model_id: m for m in model_objs}

    return model_map


def get_curve_params_for_model_ids(
    compound_id: str,
    drc_dataset_label: str,
    compound_dose_replicates: list,
    replicate_dataset_name: str,
):
    """
    Retrieve curve parameters and replicate points for all model IDs.
    """

    # Use drc_dataset_label to get the dose response curves for the dataset selected in the UI. This is necessary
    # because dose response curves have a relationship with CompoundExperiment, not Compound, and 1 compound can have
    # multiple compound experiments mapping to different datasets and therefore different sets of dose response curves.
    curve_objs = Compound.get_dose_response_curves(
        compound_id=compound_id, drc_dataset_label=drc_dataset_label
    )

    replicate_dataset_matrix = get_replicate_dataset_matrix(
        replicate_dataset_name=replicate_dataset_name
    )

    viabilities_by_model_id = replicate_dataset_matrix.get_values_by_entities_all_depmap_ids(
        entities=compound_dose_replicates
    )

    valid_depmap_ids = _HACK_get_valid_depmap_ids(
        replicate_dataset_matrix=replicate_dataset_matrix,
        compound_dose_replicates=compound_dose_replicates,
    )

    # Get a mapping of model_id to model object so that we can use model_id to
    # look up model displayName (without querying the DepmapModel table over and over)
    # while iterating through the curve_objs below.
    model_map = _get_model_map(valid_depmap_ids=valid_depmap_ids)

    curve_params = []
    dose_replicates_per_model_id = {}

    for curve in curve_objs:
        if curve is not None:

            if curve is None or curve.depmap_id not in valid_depmap_ids:
                continue

            reps = get_dose_replicate_points(
                viabilities=viabilities_by_model_id[curve.depmap_id],
                compound_dose_replicates=compound_dose_replicates,
                model_id=curve.depmap_id,
            )

            dose_replicates_per_model_id[curve.depmap_id] = reps

            # Get the model object to determine the displayName for the curve's hover label.
            model = model_map.get(curve.depmap_id)
            assert model is not None

            curve_param = {
                "id": curve.depmap_id,
                "displayName": model.stripped_cell_line_name,
                "ec50": float(curve.ec50),
                "slope": float(curve.slope),
                "lowerAsymptote": float(curve.lower_asymptote),
                "upperAsymptote": float(curve.upper_asymptote),
            }
            curve_params.append(curve_param)

    return {
        "curve_params": curve_params,
        "dose_replicate_points": dose_replicates_per_model_id,
    }


# This is somewhat of a HACK because CompoundDoseReplicate has a relationship with CompoundExperiment instead of Compound.
# There can be multiple CompoundExperiments per Compound. Each CompoundExperiment for a single Compound will have the same
# CompoundDoseReplicates. As result, here we:
# 1. Look at each Compound Experiment, are there valid CompoundDoseReplicates?
# 2. As soon as we find valid replicates, ignore any subsequent CompoundExperiments.
def get_compound_dose_replicates(
    compound_id: str, drc_dataset_label: str, replicate_dataset_name: str
):
    ces = CompoundExperiment.get_corresponding_compound_experiment_using_drc_dataset_label(
        compound_id=compound_id, drc_dataset_label=drc_dataset_label
    )

    valid_compound_dose_replicates = []

    for compound_experiment in ces:
        compound_dose_replicate_objs = CompoundDoseReplicate.get_all_with_compound_experiment_id(
            compound_experiment.entity_id
        )

        # HACK: this is only necessary due to a heuristic used when loading sample data that made it impossible to reliably
        # distinguish between oncref and repurposing compound experiments. If we are looking at a CompoundExperiment from a
        # different dataset than the one currently selected, compound_dose_replicate_objs will be of length 0, so just "continue"
        # on to the next dataset.
        if len(compound_dose_replicate_objs) == 0:
            continue

        # Make sure the dose_rep is valid (e.g. make sure it exists in the currently selected replicate dataset)
        valid_compound_dose_replicates = [
            dose_rep
            for dose_rep in compound_dose_replicate_objs
            if DependencyDataset.has_entity(replicate_dataset_name, dose_rep.entity_id)
        ]
        # Break out of the loop as soon as we have valid compound_dose_replicates and have confurmed the replicates are present in
        # the current dataset via if DependencyDataset.has_entity(replicate_dataset_name, dose_rep.entity_id)
        if len(valid_compound_dose_replicates) > 0:
            break

    return valid_compound_dose_replicates


def get_dose_response_curves_per_model(
    compound_id: str, drc_dataset_label: str, replicate_dataset_name: str
):
    """
    Setup retrieval of dose response curves and replicate points for a compound and dataset.
    """
    compound_dose_replicates = get_compound_dose_replicates(
        compound_id=compound_id,
        drc_dataset_label=drc_dataset_label,
        replicate_dataset_name=replicate_dataset_name,
    )
    curve_params_and_points = get_curve_params_for_model_ids(
        compound_id=compound_id,
        drc_dataset_label=drc_dataset_label,
        compound_dose_replicates=compound_dose_replicates,
        replicate_dataset_name=replicate_dataset_name,
    )
    curve_params = curve_params_and_points["curve_params"]
    dose_replicate_points = curve_params_and_points["dose_replicate_points"]

    return {
        "curve_params": curve_params,
        "dose_replicate_points": dose_replicate_points,
    }
