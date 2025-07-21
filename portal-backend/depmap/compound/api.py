from depmap.compound.new_dose_curves_utils import get_dose_response_curves_per_model
from flask_restplus import Namespace, Resource
from depmap.compound.models import drc_compound_datasets
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
        # TODO: Probably need to use this eventually to make sure the dataset has the compound
        # compound_id = request.args.get("compound_id")

        # TODO: How to figure out which dataset to prioritize? Right now only OncRef is supported,
        # so don't worry about this yet.
        dataset_options = [
            {
                "display_name": dataset.display_name,
                "viability_dataset_given_id": dataset.viability_dataset_given_id,
                "replicate_dataset": dataset.replicate_dataset,
                "auc_dataset_given_id": dataset.auc_dataset_given_id,
                "ic50_dataset__givenid": dataset.ic50_dataset_given_id,
                "drc_dataset_label": dataset.drc_dataset_label,
            }
            for dataset in drc_compound_datasets
        ]

        prioritized_dataset = dataset_options[0]

        return prioritized_dataset
