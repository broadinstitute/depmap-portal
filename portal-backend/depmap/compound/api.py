from typing import List
from depmap import data_access
from depmap.cell_line.models_new import DepmapModel
from depmap.compound.models import CompoundDoseReplicate, CompoundExperiment
from depmap.context_explorer import dose_curve_utils
from depmap.dataset.models import Dataset, DependencyDataset
from flask_restplus import Namespace, Resource
from flask import request


namespace = Namespace("compound", description="View compound data in the portal")


def _get_dose_response_curves_per_model(
    model_ids: List[str],
    replicate_dataset_name: str,
    compound_experiment: CompoundExperiment,
):
    dataset = Dataset.get_dataset_by_name(replicate_dataset_name)

    dose_min_max_df = CompoundDoseReplicate.get_dose_min_max_of_replicates_with_compound_experiment_id(
        compound_experiment.entity_id
    )
    assert dataset is not None
    compound_dose_replicates = [
        dose_rep
        for dose_rep in dose_min_max_df
        if DependencyDataset.has_entity(dataset.name, dose_rep.entity_id)
    ]

    model_display_names_by_model_id = DepmapModel.get_cell_line_display_names(
        list(set(model_ids))
    )

    in_group_curve_params = dose_curve_utils.get_curve_params_for_model_ids(
        model_ids=model_ids,
        model_display_names_by_model_id=model_display_names_by_model_id,
        compound_experiment=compound_experiment,
    )

    return {
        "curve_params": in_group_curve_params,
        "max_dose": compound_dose_replicates[0].max_dose,
        "min_dose": compound_dose_replicates[0].min_dose,
    }


@namespace.route("/dose_curve_data")
class DoseCurveData(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        # NOTE to self --> the preexisting functions for getting the dose curve options on the old tab provide
        # the dataset_name and compound_label options.
        dataset_name = request.args.get("dataset_name")
        replicate_dataset_name = request.args.get("replicate_dataset_name")
        compound_label = request.args.get("compound_label")

        full_row_of_values = data_access.get_row_of_values(
            dataset_id=dataset_name, feature=compound_label
        )
        model_ids = full_row_of_values.index.tolist()
        breakpoint()
        dose_curve_info = _get_dose_response_curves_per_model(
            model_ids=model_ids,
            replicate_dataset_name=replicate_dataset_name,
            compound_experiment=compound_label,
        )

        return dose_curve_info
