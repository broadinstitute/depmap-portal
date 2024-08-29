from dataclasses import dataclass
from typing import Any, Dict, List
from depmap import data_access
from depmap.gene.models import Gene
from depmap.predictability_prototype.models import PrototypePredictiveModel
from depmap.predictability_prototype.utils import (
    feature_correlation_map_calc,
    generate_aggregate_scores_across_all_models,
    generate_model_predictions,
    get_all_predictability_datasets,
    get_feature_boxplot_data,
    get_feature_corr_plot,
    get_feature_gene_effect_plot_data,
    get_feature_waterfall_plot,
    get_gene_effect_df,
    top_features_overall,
    get_top_feature_headers,
    MODEL_SEQUENCE,
    SCREEN_TYPES,
)

from flask_restplus import Namespace, Resource
from flask import request

namespace = Namespace("predictability_prototype", description="")


@namespace.route("/predictions")
class Predictions(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        # Note: docstrings to restplus methods end up in the swagger documentation.
        # DO NOT put a docstring here that you would not want exposed to users of the API. Use # for comments instead
        """
        Get the overview data and feature names list for CRISPR and RNAi predictions for a particular gene symbol
        """
        gene_symbol = request.args.get("gene_symbol")

        # Overview data
        gene_effect_df = get_gene_effect_df()
        predictablity_datasets = get_all_predictability_datasets()

        data_by_screen_type = {}
        for screen_type in SCREEN_TYPES:
            entity_id = Gene.get_by_label(gene_symbol).entity_id

            agg_scores = generate_aggregate_scores_across_all_models(
                gene_symbol,
                entity_id=entity_id,
                screen_type=screen_type,
                datasets=predictablity_datasets,
                actuals=gene_effect_df,
            )

            top_features, gene_tea_symbols = top_features_overall(
                gene_symbol, entity_id=entity_id
            )

            model_performance_info = {}

            for model in MODEL_SEQUENCE:
                feature_header_info = get_top_feature_headers(
                    entity_id=entity_id, model=model, screen_type=screen_type
                )
                r = PrototypePredictiveModel.get_r_squared_for_model(model)
                model_performance_info[model] = {
                    "r": r,
                    "feature_summaries": feature_header_info,
                }

            data_by_screen_type[screen_type] = {
                "overview": {
                    "aggregated_scores": agg_scores,
                    "top_features": top_features,
                    "gene_tea_symbols": list(gene_tea_symbols),
                },
                "model_performance_info": model_performance_info,
            }

        return data_by_screen_type


@namespace.route("/model_performance")
class ModelPerformance(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        # Note: docstrings to restplus methods end up in the swagger documentation.
        # DO NOT put a docstring here that you would not want exposed to users of the API. Use # for comments instead
        """
        test
        """
        entity_label = request.args.get("entity_label")
        model = request.args.get("model")
        screen_type = request.args.get("screen_type")

        entity_id = Gene.get_by_label(entity_label).entity_id
        gene_effect_df = get_gene_effect_df(screen_type)
        model_predictions = generate_model_predictions(
            gene_symbol=entity_label,
            screen_type=screen_type,
            model=model,
            actuals=gene_effect_df,
        )
        corr = feature_correlation_map_calc(
            model, entity_id=entity_id, screen_type=screen_type
        )

        return {"model_predictions": model_predictions, "corr": corr["corr"]}


@namespace.route("/feature/related_correlations")
class RelatedCorrelations(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        # Note: docstrings to restplus methods end up in the swagger documentation.
        # DO NOT put a docstring here that you would not want exposed to users of the API. Use # for comments instead
        """
        test
        """
        entity_label = request.args.get("entity_label")
        feature_name_type = request.args.get("identifier")
        model = request.args.get("model")
        screen_type = request.args.get("screen_type")

        entity_id = Gene.get_by_label(entity_label).entity_id

        plot = get_feature_corr_plot(
            screen_type=screen_type,
            model=model,
            entity_id=entity_id,
            gene_symbol=entity_label,
            feature_name_type=feature_name_type,
        )

        return plot


@namespace.route("/feature/waterfall")
class Waterfall(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        # Note: docstrings to restplus methods end up in the swagger documentation.
        # DO NOT put a docstring here that you would not want exposed to users of the API. Use # for comments instead
        """
        test
        """
        entity_label = request.args.get("entity_label")
        feature_name_type = request.args.get("identifier")
        model = request.args.get("model")
        screen_type = request.args.get("screen_type")

        entity_id = Gene.get_by_label(entity_label).entity_id

        plot = get_feature_waterfall_plot(
            screen_type=screen_type,
            model=model,
            entity_id=entity_id,
            feature_name_type=feature_name_type,
        )

        return plot


@namespace.route("/feature/boxplot")
class BoxPlot(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        # Note: docstrings to restplus methods end up in the swagger documentation.
        # DO NOT put a docstring here that you would not want exposed to users of the API. Use # for comments instead
        """
        test
        """
        feature_name_type = request.args.get("identifier")
        entity_label = request.args.get("entity_label")
        model = request.args.get("model")
        screen_type = request.args.get("screen_type")

        plot = get_feature_boxplot_data(
            screen_type=screen_type,
            feature_name=feature_name_type,
            entity_label=entity_label,
            model=model,
        )

        return plot


@namespace.route("/feature/gene_effect_data")
class GeneEffectData(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        # Note: docstrings to restplus methods end up in the swagger documentation.
        # DO NOT put a docstring here that you would not want exposed to users of the API. Use # for comments instead
        """
        test
        """
        feature_name_type = request.args.get("identifier")
        feature_index = request.args.get("feature_index")
        model = request.args.get("model")
        entity_label = request.args.get("entity_label")
        screen_type = request.args.get("screen_type")

        entity_id = Gene.get_by_label(entity_label).entity_id

        plot = get_feature_gene_effect_plot_data(
            model=model,
            gene_symbol=entity_label,
            feature_index=feature_index,
            feature_name=feature_name_type,
            screen_type=screen_type,
            entity_id=entity_id,
        )

        return plot
