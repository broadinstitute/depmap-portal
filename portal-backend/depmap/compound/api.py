import dataclasses
from typing import Any
from depmap import data_access
from depmap.compound.models import Compound
from depmap.compound.new_dose_curves_utils import get_dose_response_curves_per_model
from depmap.compound.views.index import (
    get_corr_analysis_options,
    get_heatmap_dose_curves_tab_drc_options,
)
from depmap.entity.views.executive import (
    format_overall_top_model,
    format_top_three_models_top_feature,
    get_percentile,
    sort_by_model_pearson_feature_rank,
)
from depmap.predictability.models import PredictiveBackground, PredictiveModel
from depmap.utilities import color_palette, number_utils
import pandas as pd
from flask_restplus import Namespace, Resource
from flask import jsonify, request

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


@namespace.route("/predictability_tile_data")
class PredictabilityTileData(Resource):
    def get(self):
        feature_id = request.args.get("compound_id")
        args: Any = request.args
        compound_dataset_ids = args.getlist("compound_dataset_ids")

        data = self.format_predictability_tile_json(
            feature_id=feature_id, dataset_ids=compound_dataset_ids
        )

        if data is None:
            return {"message": "No predictability data found"}, 404

        return jsonify(data)

    def format_predictability_tile_json(self, feature_id, dataset_given_ids):
        plot_params = []

        # Mapping for colors and types (TODO: move to a config/const file)
        ID_MAP = {
            "Chronos_Combined": ("crispr", color_palette.crispr_color),
            "RNAi_merged": ("rnai", color_palette.rnai_color),
            "Rep_all_single_pt_per_compound": (
                "rep_all_single_pt",
                color_palette.rep_all_single_pt_color,
            ),
            "PRISMOncologyReferenceLog2AUCMatrix": (
                "prism_onc_ref",
                color_palette.prism_oncology_color,
            ),
            "PRISMOncologyReferenceSeqLog2AUCMatrix": (
                "prism_onc_seq_ref",
                color_palette.prism_oncology_color,
            ),
        }

        for given_id in dataset_given_ids:
            if not given_id or given_id not in ID_MAP:
                continue

            df = PredictiveModel.get_top_models_features(
                dataset_given_id=given_id, pred_model_feature_id=str(feature_id)
            )
            if df is None or df.empty:
                continue

            dataset_type, color = ID_MAP[given_id]
            dataset = data_access.get_matrix_dataset(given_id)
            background = PredictiveBackground.get_background(given_id)

            plot_params.append(
                {
                    "df": df,
                    "background": background,
                    "label": dataset.label,
                    "type": dataset_type,
                    "color": color,
                }
            )

        if not plot_params:
            return None

        # Sort combined models
        unsorted_df = pd.concat([p["df"] for p in plot_params])
        sorted_df = sort_by_model_pearson_feature_rank(unsorted_df)

        # Build the JSON response
        response = {
            "plot_data": [],
            "overall_top_model": format_overall_top_model(sorted_df),
            "tables": [],
        }

        for p in plot_params:
            # Get the specific pearson value for this dataset from the sorted results
            subset = sorted_df[sorted_df["type"] == p["type"]]
            query_value = float(subset.iloc[0]["model_pearson"])

            # 1. Data for the GenericDistributionPlot
            response["plot_data"].append(
                {
                    "label": p["label"],
                    "type": p["type"],
                    "color": p["color"],
                    "query_value": query_value,
                    "percentile": number_utils.format_3_sf(
                        get_percentile(query_value, p["background"])
                    ),
                    # Convert series to list for JSON
                    "background_values": p["background"].tolist(),
                }
            )

            # 2. Data for the Tables
            response["tables"].append(
                {
                    "type": p["type"],
                    "dataset": p["label"],
                    "dataset_given_id": p.get(
                        "dataset_given_id"
                    ),  # For the header logic in React
                    "top_models": format_top_three_models_top_feature(
                        sorted_df, p["type"]
                    ),
                }
            )

        return response
