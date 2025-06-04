from typing import List
from depmap.cell_line.models_new import DepmapModel
from depmap.compound.models import Compound, CompoundDoseReplicate
from depmap.context_explorer import utils
from depmap.dataset.models import Dataset, DependencyDataset
from depmap.partials.matrix.models import Matrix
import math
from flask_restplus import Namespace, Resource
from flask import request


namespace = Namespace("compound", description="View compound data in the portal")


def _get_dose_replicate_points(
    replicate_dataset_matrix: Matrix, compound_dose_replicates: list, model_id: str
):
    # call the get_values_by_entities_and_depmap_id function in matrix, passing in entities and depmap id
    viabilities = replicate_dataset_matrix.get_values_by_entities_and_depmap_id(
        entities=compound_dose_replicates, depmap_id=model_id
    )

    # points only contains viability -- we need to add on dose, isMasked, and replicate ourselves
    assert len(compound_dose_replicates) == len(viabilities)
    points = []

    # NOTE: New - merge this with the viability information on the frontend using
    # Breadbox data.
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


def _get_dose_replicate_points_per_model_id(
    replicate_dataset_matrix: Matrix,
    compound_dose_replicates: list,
    model_ids: List[str],
):
    dose_replicates_per_model_id = {}
    for model_id in model_ids:
        reps = _get_dose_replicate_points(
            replicate_dataset_matrix=replicate_dataset_matrix,
            compound_dose_replicates=compound_dose_replicates,
            model_id=model_id,
        )
        dose_replicates_per_model_id[model_id] = reps

    return dose_replicates_per_model_id


def get_curve_params_for_model_ids(compound_id: str, drc_dataset_label: str):
    curve_objs = Compound.get_dose_response_curves(
        compound_id=compound_id, drc_dataset_label=drc_dataset_label
    )

    curve_params = []
    for curve in curve_objs:
        if curve is not None:
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

    return curve_params


def _get_dose_response_curves_per_model(
    dataset_name: str, compound_id: str, drc_dataset_label: str
):
    dataset = Dataset.get_dataset_by_name(dataset_name)
    units = dataset.units

    dose_min_max_df = CompoundDoseReplicate.get_dose_min_max_of_replicates_with_compound_id(
        compound_id=compound_id
    )

    compound_dose_replicates = [dose_rep for dose_rep in dose_min_max_df]

    in_group_curve_params = get_curve_params_for_model_ids(
        compound_id=compound_id, drc_dataset_label=drc_dataset_label,
    )

    return {
        "curve_params": in_group_curve_params,
        "max_dose": compound_dose_replicates[0].max_dose,
        "min_dose": compound_dose_replicates[0].min_dose,
        "dataset_units": units,
    }


@namespace.route("/dose_curve_data")
class DoseCurveData(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        dataset_name = request.args.get("dataset_name")
        compound_id = request.args.get("compound_id")
        drc_dataset_label = request.args.get("drc_dataset_label")

        dose_curve_info = _get_dose_response_curves_per_model(
            dataset_name=dataset_name,
            compound_id=compound_id,
            drc_dataset_label=drc_dataset_label,
        )

        return dose_curve_info


@namespace.route("/model_dose_replicates")
class ModelDoseReplicates(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        # NOTE to self --> the preexisting functions for getting the dose curve options on the old tab provide
        # the dataset_name and compound_label options.
        replicate_dataset_name = request.args.get("replicate_dataset_name")
        compound_label = request.args.get("compound_label")
        model_ids = request.args.getlist("model_ids")

        replicate_dataset = Dataset.get_dataset_by_name(replicate_dataset_name)
        compound_experiment = utils.get_compound_experiment(
            entity_full_label=compound_label
        )

        # get all CompoundDoseReplicate objects associated with CompoundExperiment
        compound_dose_replicates = CompoundDoseReplicate.get_all_with_compound_experiment_id(
            compound_experiment.entity_id
        )
        compound_dose_replicates = [
            dose_rep
            for dose_rep in compound_dose_replicates
            if DependencyDataset.has_entity(replicate_dataset.name, dose_rep.entity_id)
        ]

        points_per_model = _get_dose_replicate_points_per_model_id(
            model_ids=model_ids,
            replicate_dataset_matrix=replicate_dataset.matrix,
            compound_dose_replicates=compound_dose_replicates,
        )

        return points_per_model
