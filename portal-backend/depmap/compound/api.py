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
    """
    Endpoint for Compound Page components.
    
    GOAL: Consolidate data-loading for React tabs (Sensitivity, Heatmap, DRC, 
    and Correlation) into a single high-performance request.
    
    - view_compound (index.py): Returns the initial HTML template and high-level 
      static metadata (IDs, names, aliases) via Jinja2.
    - /compound_summary (api.py): Returns JSON dataset options, priority-sorted 
      configs, and shared parameters used by multiple React tiles/tabs.
    
    By centralizing 'options' here, we ensure consistent dataset priority across 
    the UI and reduce the network waterfall on page load.
    """

    def get(self):
        compound_id = request.args.get("compound_id")
        compound_label = request.args.get("compound_label")
        args: Any = request.args
        compound_dataset_ids = args.getlist("compound_dataset_ids")

        # 1. Fetch Sensitivity Tab Data: Sorted by priority to ensure
        # the 'Best' dataset is selected by default in the dropdown.
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
                                "priority": dataset.priority
                                if dataset.priority is not None
                                else 999,
                            }
                        )

                if dataset_options:
                    ordered_options = sorted(
                        dataset_options, key=lambda x: x["priority"]
                    )
                    # sensitivity data is the data required to load the "Sensitivity" React tab. The Sensitivity tab
                    # makes use of a React component called EntitySummary (due to it's reuse in multiple differently named
                    # locations in the UI (i.e. the Perturbation Effects tab and the Characterization tab on the Gene page)).
                    sensitivity_data = {
                        "figure": {"name": compound.entity_id},
                        "summary_options": ordered_options,
                        "show_auc_message": True,
                        "size_biom_enum_name": None,
                        "color": None,
                    }

        # 2. Fetch Heatmap and Dose Curve shared Options: We consolidate them here so the frontend knows which tabs to show/hide
        # without making multiple separate HEAD or GET requests.
        drc_options = get_heatmap_dose_curves_tab_drc_options(
            compound_label=compound_label, compound_id=compound_id
        )
        serializable_drc = [dataclasses.asdict(opt) for opt in drc_options]

        # 3. Fetch Correlation Analysis Options: Nearly identical to the Heatmap and Dose Curve get_heatmap_dose_curves_tab_drc_options logic,
        # but for correlations, we do not care about the replicate datasets.
        corr_options = get_corr_analysis_options(compound_label=compound_label)
        serializable_corr = [dataclasses.asdict(opt) for opt in corr_options]

        # 4. Return consolidated response
        return {
            "sensitivity_summary": sensitivity_data,
            "heatmap_dose_curve_options": serializable_drc,
            "correlation_analysis_options": serializable_corr,
        }
