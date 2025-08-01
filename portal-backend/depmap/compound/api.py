import dataclasses
from depmap.compound.new_dose_curves_utils import get_dose_response_curves_per_model
from depmap.compound.views.index import format_heatmap_options_new_tab_if_available
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

        dataset_options = format_heatmap_options_new_tab_if_available(
            compound_label=compound_label
        )
        prioritized_dataset = dataset_options[0]

        return dataclasses.asdict(prioritized_dataset)
