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
    MODEL_SEQUENCE,
)

from flask_restplus import Namespace, Resource
from flask import request
from loader.predictability_summary_loader import load_predictability_prototype
from depmap.database import db

namespace = Namespace("predictability_prototype", description="")


@namespace.route("/predictions")
class Predictions(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        # Note: docstrings to restplus methods end up in the swagger documentation.
        # DO NOT put a docstring here that you would not want exposed to users of the API. Use # for comments instead
        """
        test
        """
        gene_symbol = request.args.get("gene_symbol")
        # statements = [
        #     "drop table if exists prototype_predictive_feature",
        #     """CREATE TABLE IF NOT EXISTS prototype_predictive_feature (
        #     feature_id STRING PRIMARY KEY,
        #     feature_name STRING,
        #     feature_label STRING,
        #     dim_type STRING,
        #     taiga_id STRING,
        #     given_id STRING
        # );""",
        #     "drop table if exists prototype_predictive_model",
        #     """CREATE TABLE IF NOT EXISTS prototype_predictive_model (
        #     predictive_model_id INTEGER PRIMARY KEY AUTOINCREMENT,
        #     entity_id INTEGER,
        #     label STRING,
        #     screen_type STRING,
        #     pearson FLOAT,
        #     CONSTRAINT prototype_predictive_model_FK FOREIGN KEY (entity_id) REFERENCES entity(entity_id)
        # );""",
        #     "drop table if exists prototype_predictive_feature_result",
        #     """CREATE TABLE IF NOT EXISTS prototype_predictive_feature_result (
        #     predictive_feature_result_id INTEGER PRIMARY KEY AUTOINCREMENT,
        #     predictive_model_id INTEGER,
        #     feature_id STRING,
        #     screen_type STRING,
        #     rank INTEGER,
        #     importance FLOAT,
        #     CONSTRAINT prototype_predictive_feature_result_FK FOREIGN KEY (predictive_model_id) REFERENCES prototype_predictive_model(predictive_model_id),
        #     CONSTRAINT prototype_predictive_feature_result2_FK FOREIGN KEY (feature_id) REFERENCES prototype_predictive_feature(feature_id) ON DELETE CASCADE
        # );""",
        # ]
        # db.session.execute("PRAGMA foreign_keys = 0;")
        # for statement in statements:
        #     db.session.execute(statement)

        # cell_context = pd.read_csv(
        #     "/Users/amourey/dev/depmap-portal/portal-backend/depmap/predictability_prototype/scripts/CellContextSummary.csv",
        # )
        # cell_context["model"] = "CellContext"
        # driver_events = pd.read_csv(
        #     "/Users/amourey/dev/depmap-portal/portal-backend/depmap/predictability_prototype/scripts/DriverEventsSummary.csv",
        # )
        # driver_events["model"] = "DriverEvents"
        # rna_seq = pd.read_csv(
        #     "/Users/amourey/dev/depmap-portal/portal-backend/depmap/predictability_prototype/scripts/RNASeqSummary.csv",
        # )
        # rna_seq["model"] = "RNASeq"

        # genetic_derangement = pd.read_csv(
        #     "/Users/amourey/dev/depmap-portal/portal-backend/depmap/predictability_prototype/scripts/GeneticDerangementSummary.csv"
        # )
        # genetic_derangement["model"] = "GeneticDerangement"
        # dna = pd.read_csv(
        #     "/Users/amourey/dev/depmap-portal/portal-backend/depmap/predictability_prototype/scripts/DNASummary.csv"
        # )
        # dna["model"] = "DNA"
        # combination = pd.concat(
        #     [cell_context, driver_events, rna_seq, genetic_derangement, dna]
        # )
        # combination.to_csv(
        #     "/Users/amourey/dev/depmap-portal/portal-backend/depmap/predictability_prototype/scripts/combination.csv"
        # )

        # ensemble_crispr: predictability-76d5.110/ensemble_crispr
        # ensemble_rnai: predictability-76d5.110/ensemble_rnai
        # feature_metadata_crispr: predictability-76d5.110/feature_metadata_crispr
        # feature_metadata_rnai: predictability-76d5.110/feature_metadata_rnai

        # load_predictability_prototype(
        #     "/Users/amourey/dev/depmap-portal/portal-backend/depmap/predictability_prototype/scripts/ensemble_crispr.csv",
        #     "/Users/amourey/dev/depmap-portal/portal-backend/depmap/predictability_prototype/scripts/feature_metadata_crispr.csv",
        #     "crispr",
        # )
        # load_predictability_prototype(
        #     "/Users/amourey/dev/depmap-portal/portal-backend/depmap/predictability_prototype/scripts/ensemble_rnai.csv",
        #     "/Users/amourey/dev/depmap-portal/portal-backend/depmap/predictability_prototype/scripts/feature_metadata_rnai.csv",
        #     "rnai",
        # )

        # db.session.commit()
        # breakpoint()

        # Overview data
        import time

        start = time.time()
        # <code to time>
        gene_effect_df = get_gene_effect_df()
        predictablity_datasets = get_all_predictability_datasets()

        # TODO: TAKE OUT
        screen_type = "crispr"

        agg_scores = generate_aggregate_scores_across_all_models(
            gene_symbol,
            screen_type=screen_type,
            datasets=predictablity_datasets,
            actuals=gene_effect_df,
        )

        top_features, gene_tea_symbols = top_features_overall(gene_symbol)
        # breakpoint()
        print(gene_tea_symbols)
        model_performance_data = {}

        for model in MODEL_SEQUENCE:
            model_predictions = generate_model_predictions(
                gene_symbol=gene_symbol,
                screen_type=screen_type,
                model=model,
                actuals=gene_effect_df,
            )
            corr = feature_correlation_map_calc(
                model, gene_symbol, screen_type=screen_type
            )
            metadata: dict = corr["metadata"]
            r = PrototypePredictiveModel.get_r_squared_for_model(model)

            model_performance_data[model] = {
                "model_predictions": model_predictions,
                "corr": corr["corr"],
                "r": r,
                "feature_summaries": metadata.to_dict(),
            }

        end = time.time()
        print(f"Total {end-start} seconds")

        return {
            "overview": {
                "aggregated_scores": agg_scores,
                "top_features": top_features,
                "gene_tea_symbols": list(gene_tea_symbols),
            },
            "model_performance_data": model_performance_data,
        }


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
        screen_type = "crispr"
        plot = get_feature_corr_plot(
            screen_type=screen_type,
            model=model,
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
        screen_type = "crispr"

        plot = get_feature_waterfall_plot(
            screen_type=screen_type,
            model=model,
            gene_symbol=entity_label,
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
        screen_type = "crispr"

        plot = get_feature_boxplot_data(
            screen_type=screen_type,
            feature_name_type=feature_name_type,
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
        feature_name = request.args.get("feature_name")
        feature_type = request.args.get("feature_type")
        feature_name_type = request.args.get("identifier")
        feature_index = request.args.get("feature_index")
        model = request.args.get("model")
        entity_label = request.args.get("entity_label")
        screen_type = "crispr"

        plot = get_feature_gene_effect_plot_data(
            model=model,
            gene_symbol=entity_label,
            feature_index=feature_index,
            feature_name=feature_name,
            feature_type=feature_type,
            screen_type=screen_type,
        )

        return plot
