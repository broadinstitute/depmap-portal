import dataclasses
from depmap import data_access
from depmap.compound.new_dose_curves_utils import get_dose_response_curves_per_model
from depmap.compound.views.index import get_drc_options_if_new_tabs_available
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

        dataset_options = get_drc_options_if_new_tabs_available(
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
