from depmap.gene.models import Gene
from depmap.predictability_prototype.models import PrototypePredictiveModel
from depmap.predictability_prototype.utils import (
    feature_correlation_map_calc,
    generate_aggregate_scores_across_all_models,
    generate_model_predictions,
    get_all_datasets,
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
from depmap.data_access import interface as data_access

from flask_restplus import Namespace, Resource
from flask import request
from depmap.dataset.models import DependencyDataset
from loader.predictability_summary_loader import load_predictability_prototype
from depmap.database import db
import logging

logger = logging.getLogger(__name__)
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
        #     predictions_dataset_taiga_id STRING,
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

        # # ensemble_crispr: predictability-76d5.110/ensemble_crispr
        # # ensemble_rnai: predictability-76d5.110/ensemble_rnai
        # # feature_metadata_crispr: predictability-76d5.110/feature_metadata_crispr
        # # feature_metadata_rnai: predictability-76d5.110/feature_metadata_rnai

        # load_predictability_prototype(
        #     "/Users/amourey/dev/depmap-portal/portal-backend/depmap/predictability_prototype/scripts/merged-output-model-config.json"
        # )

        # db.session.commit()
        # breakpoint()

        # Overview data
        try:
            logger.warning(f"get predictions start")
            matrix_datasets = data_access.get_all_matrix_datasets()
            datasets_by_taiga_id = get_all_datasets(matrix_datasets)

            data_by_screen_type = {}
            for screen_type in SCREEN_TYPES:
                logger.warning(f"fetching {screen_type}")
                dataset = DependencyDataset.get_dataset_by_data_type_priority(
                    screen_type
                )

                logger.warning(f"fetching {screen_type} gene effect")

                entity_id = Gene.get_by_label(gene_symbol).entity_id

                logger.warning(f"generate_aggregate_scores_across_all_models")
                agg_scores = generate_aggregate_scores_across_all_models(
                    entity_id=entity_id, screen_type=screen_type,
                )

                logger.warning(f"top_features_overall")
                top_features, gene_tea_symbols = top_features_overall(
                    gene_symbol, entity_id=entity_id, screen_type=screen_type
                )

                model_performance_info = {}
                for model in MODEL_SEQUENCE:
                    logger.warning(f"model {model}")
                    feature_header_info = get_top_feature_headers(
                        entity_id=entity_id, model=model, screen_type=screen_type
                    )
                    # r = PrototypePredictiveModel.get_r_squared_for_model(model)
                    model_performance_info[model] = {
                        "r": 0.71,
                        "feature_summaries": feature_header_info,
                    }
                    logger.warning(f"feature_header_info={feature_header_info}")

                data_by_screen_type[screen_type] = {
                    "overview": {
                        "aggregated_scores": agg_scores,
                        "top_features": top_features,
                        "gene_tea_symbols": list(gene_tea_symbols),
                    },
                    "model_performance_info": model_performance_info,
                }

        except Exception as e:
            logger.exception("Exception occurred")
            return {"error_message": str(e)}

        return {"data": data_by_screen_type}


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
        dataset = DependencyDataset.get_dataset_by_data_type_priority(screen_type)
        gene_effect_df = get_gene_effect_df(dataset)
        matrix_datasets = data_access.get_all_matrix_datasets()

        model_predictions = generate_model_predictions(
            gene_symbol=entity_label,
            screen_type=screen_type,
            model=model,
            actuals=gene_effect_df,
            entity_id=entity_id,
            matrix_datasets=matrix_datasets,
        )

        corr = feature_correlation_map_calc(
            model,
            entity_id=entity_id,
            screen_type=screen_type,
            matrix_datasets=matrix_datasets,
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
        matrix_datasets = data_access.get_all_matrix_datasets()

        plot = get_feature_corr_plot(
            screen_type=screen_type,
            model=model,
            entity_id=entity_id,
            gene_symbol=entity_label,
            feature_name_type=feature_name_type,
            matrix_datasets=matrix_datasets,
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
        matrix_datasets = data_access.get_all_matrix_datasets()

        plot = get_feature_waterfall_plot(
            screen_type=screen_type,
            model=model,
            entity_id=entity_id,
            feature_name_type=feature_name_type,
            entity_label=entity_label,
            matrix_datasets=matrix_datasets,
        )

        return plot


@namespace.route("/feature/boxbarplot")
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

        matrix_datasets = data_access.get_all_matrix_datasets()

        plot = get_feature_boxplot_data(
            screen_type=screen_type,
            feature_name=feature_name_type,
            entity_label=entity_label,
            model=model,
            matrix_datasets=matrix_datasets,
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
        matrix_datasets = data_access.get_all_matrix_datasets()

        plot = get_feature_gene_effect_plot_data(
            model=model,
            gene_symbol=entity_label,
            feature_index=feature_index,
            feature_name=feature_name_type,
            screen_type=screen_type,
            entity_id=entity_id,
            matrix_datasets=matrix_datasets,
        )

        return plot
