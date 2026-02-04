import dataclasses
from depmap import data_access
from depmap.compound.models import Compound
from depmap.compound.new_dose_curves_utils import get_dose_response_curves_per_model
from depmap.compound.views.index import get_new_dose_curves_tab_drc_options
from flask_restplus import Namespace, Resource
from flask import request

namespace = Namespace("compound", description="View compound data in the portal")


@namespace.route("/dose_curve_data")
class DoseCurveData(Resource):
    def get(self):
        compound_id = request.args.get("compound_id")
        drc_dataset_label = request.args.get("drc_dataset_label")
        replicate_dataset_name = request.args.get("replicate_dataset_name")

        dose_curve_info = get_dose_response_curves_per_model(
            compound_id=compound_id,
            drc_dataset_label=drc_dataset_label,
            replicate_dataset_name=replicate_dataset_name,
        )

        return dose_curve_info


@namespace.route("/prioritized_dataset")
class PrioritizedDataset(Resource):
    def get(self):
        compound_label = request.args.get("compound_label")
        compound_id = request.args.get("compound_id")

        dataset_options = get_new_dose_curves_tab_drc_options(
            compound_label=compound_label, compound_id=compound_id
        )

        # Find the dataset with the lowest priority. Priority can be None, and the lowest priority won't necessarily
        # have a priority of 1, because this compound might not exist in the dataset with priority 1. dataset_options
        # will only have the options for which this compound exists.
        sorted_data = sorted(
            dataset_options,
            key=lambda dataset: dataset.auc_dataset_priority
            if dataset.auc_dataset_priority is not None
            else float("inf"),
        )

        return dataclasses.asdict(sorted_data[0])


@namespace.route("/sensitivity_summary")
class SensitivitySummary(Resource):
    def get(self):
        compound_id = request.args.get("compound_id")
        compound_dataset_ids = request.args.get("compound_dataset_ids")

        """Get a dictionary of values containing layout information for the sensitivity tab."""
        if len(compound_dataset_ids) == 0:
            return None

        compound = Compound.get_by_compound_id(compound_id=compound_id)

        if compound is None:
            return None

        compound_entity_id = compound.entity_id

        # Define the options that will appear in the datasets dropdown
        dataset_options = []
        for dataset_id in compound_dataset_ids:
            dataset = data_access.get_matrix_dataset(dataset_id=dataset_id)
            if dataset is None:
                continue
            dataset_summary = {
                "label": dataset.label,
                "id": dataset.id,
                "dataset": dataset.id,
                "entity": compound_entity_id,
            }
            dataset_options.append(dataset_summary)

        if len(dataset_options) == 0:
            return None

        return {
            "figure": {"name": compound_entity_id},
            "summary_options": dataset_options,
            "show_auc_message": True,
            "size_biom_enum_name": None,
            "color": None,
        }
