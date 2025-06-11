from depmap.cell_line.models_new import DepmapModel
from depmap.compound.models import (
    Compound,
    CompoundDoseReplicate,
    CompoundExperiment,
)
from depmap.context_explorer import utils
from depmap.dataset.models import Dataset, DependencyDataset
from depmap.partials.matrix.models import Matrix
import math
from flask_restplus import Namespace, Resource
from flask import request


namespace = Namespace("compound", description="View compound data in the portal")


def _get_dose_replicate_points(
    viabilities: list, compound_dose_replicates: list, model_id: str
):

    # points only contains viability -- we need to add on dose, isMasked, and replicate ourselves
    assert len(compound_dose_replicates) == len(viabilities)

    points = []
    for i in range(len(viabilities)):
        if (viabilities[i] is not None) & (not math.isnan(viabilities[i])):
            points.append(
                {
                    "id": model_id,
                    "dose": compound_dose_replicates[i].dose,
                    "viability": viabilities[i].item(),
                    "isMasked": compound_dose_replicates[i].is_masked,
                    "replicate": compound_dose_replicates[i].replicate,
                }
            )

    return points


def get_curve_params_for_model_ids(
    compound_id: str,
    drc_dataset_label: str,
    compound_dose_replicates: list,
    replicate_dataset_name: str,
):
    curve_objs = Compound.get_dose_response_curves(
        compound_id=compound_id, drc_dataset_label=drc_dataset_label
    )

    replicate_dataset = Dataset.get_dataset_by_name(replicate_dataset_name)
    replicate_dataset_matrix = replicate_dataset.matrix
    viabilities_by_model_id = replicate_dataset_matrix.get_values_by_entities_all_depmap_ids(
        entities=compound_dose_replicates
    )

    curve_params = []
    dose_replicates_per_model_id = {}

    for curve in curve_objs:
        if curve is not None:

            # HACK: This should not be necessary in production. But during development, my code
            # is using a hack that could result in curve_objs that are actually from the Repurposing
            # dataset, and not OncRef. We want to skip these curves.
            if (
                not Dataset.has_cell_line(
                    dataset_name=replicate_dataset_name, depmap_id=curve.depmap_id
                )
                or viabilities_by_model_id.get(curve.depmap_id) is None
            ):
                continue

            reps = _get_dose_replicate_points(
                viabilities=viabilities_by_model_id[curve.depmap_id],
                compound_dose_replicates=compound_dose_replicates,
                model_id=curve.depmap_id,
            )
            dose_replicates_per_model_id[curve.depmap_id] = reps

            # Get the model to get the display name for the graph hover labels
            model = DepmapModel.get_by_model_id(curve.depmap_id)

            curve_param = {
                "id": curve.depmap_id,
                "displayName": model.stripped_cell_line_name,
                "ec50": curve.ec50,
                "slope": curve.slope,
                "lowerAsymptote": curve.lower_asymptote,
                "upperAsymptote": curve.upper_asymptote,
            }
            curve_params.append(curve_param)

    return {
        "curve_params": curve_params,
        "dose_replicate_points": dose_replicates_per_model_id,
    }


def _get_dose_response_curves_per_model(
    compound_id: str, drc_dataset_label: str, replicate_dataset_name: str
):
    ces = CompoundExperiment.get_corresponding_compound_experiment_using_drc_dataset_label(
        compound_id=compound_id, drc_dataset_label=drc_dataset_label
    )
    for compound_experiment in ces:
        compound_dose_replicates = CompoundDoseReplicate.get_all_with_compound_experiment_id(
            compound_experiment.entity_id
        )
        if len(compound_dose_replicates) == 0:
            continue
        compound_dose_replicates = [
            dose_rep
            for dose_rep in compound_dose_replicates
            if DependencyDataset.has_entity(replicate_dataset_name, dose_rep.entity_id)
        ]
        if len(compound_dose_replicates) > 0:
            break

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
        "max_dose": 0.0001,
        "min_dose": 3.00,
        "dataset_units": "",  # Is this used for anything?
    }


@namespace.route("/dose_curve_data")
class DoseCurveData(Resource):
    def get(self):
        compound_id = request.args.get("compound_id")
        drc_dataset_label = request.args.get("drc_dataset_label")
        replicate_dataset_name = request.args.get("replicate_dataset_name")

        # Get curve params and min/max dose
        dose_curve_info = _get_dose_response_curves_per_model(
            compound_id=compound_id,
            drc_dataset_label=drc_dataset_label,
            replicate_dataset_name=replicate_dataset_name,
        )

        return dose_curve_info
