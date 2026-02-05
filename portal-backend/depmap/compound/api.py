import dataclasses
from typing import Any
from depmap import data_access
from depmap.compound.models import Compound
from depmap.compound.new_dose_curves_utils import get_dose_response_curves_per_model
from depmap.compound.views.index import (
    get_corr_analysis_options,
    get_heatmap_dose_curves_tab_drc_options,
)
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

        dataset_options = get_heatmap_dose_curves_tab_drc_options(
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


@namespace.route("/compound_summary")
class CompoundSummary(Resource):
    def get(self):
        compound_id = request.args.get("compound_id")
        compound_label = request.args.get("compound_label")
        args: Any = request.args
        compound_dataset_ids = args.getlist("compound_dataset_ids")

        # 1. Fetch Sensitivity Summary Data
        sensitivity_data = None
        if compound_dataset_ids:
            compound = Compound.get_by_compound_id(compound_id=compound_id)
            if compound:
                dataset_options = []
                for dataset_id in compound_dataset_ids:
                    dataset = data_access.get_matrix_dataset(dataset_id=dataset_id)
                    if dataset:
                        dataset_options.append(
                            {
                                "label": dataset.label,
                                "id": dataset.id,
                                "dataset": dataset.id,
                                "entity": compound.entity_id,
                            }
                        )

                if dataset_options:
                    sensitivity_data = {
                        "figure": {"name": compound.entity_id},
                        "summary_options": dataset_options,
                        "show_auc_message": True,
                        "size_biom_enum_name": None,
                        "color": None,
                    }

        # 2. Fetch Heatmap and Dose Curve Options
        drc_options = get_heatmap_dose_curves_tab_drc_options(
            compound_label=compound_label, compound_id=compound_id
        )
        serializable_drc = [dataclasses.asdict(opt) for opt in drc_options]

        # 3. Fetch Correlation Analysis Options
        corr_options = get_corr_analysis_options(compound_label=compound_label)
        serializable_corr = [dataclasses.asdict(opt) for opt in corr_options]

        # 4. Return consolidated response
        return {
            "sensitivity_summary": sensitivity_data,
            "heatmap_dose_curve_options": serializable_drc,
            "correlation_analysis_options": serializable_corr,
        }
