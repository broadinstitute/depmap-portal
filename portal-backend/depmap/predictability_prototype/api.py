from depmap.gene.models import Gene
from depmap.predictability_prototype.models import PrototypePredictiveModel
from depmap.predictability_prototype.utils import (
    feature_correlation_map_calc,
    generate_aggregate_scores_across_all_models,
    generate_model_predictions,
    get_feature_boxplot_data,
    get_feature_corr_plot,
    get_feature_gene_effect_plot_data,
    get_gene_effect_df,
    top_features_overall,
    get_top_feature_summaries,
    MODEL_SEQUENCE,
    SCREEN_TYPES,
)
from depmap.predictability_prototype.schemas import (
    PredictabilityData,
    PredData,
    ScreenTypeData,
    OverviewData,
    ModelPerformanceInfo,
    GeneTeaSearchTerm,
)
from depmap.data_access import interface as data_access

from flask_restplus import Namespace, Resource
from flask import request
from depmap.dataset.models import DependencyDataset
import logging

logger = logging.getLogger(__name__)
namespace = Namespace("predictability_prototype", description="")


def get_taiga_to_bb_dataset_id():
    mapping = {}

    for dataset in data_access.get_all_matrix_datasets():
        if dataset.taiga_id is None:
            continue
        dataset_id = dataset.id
        if dataset_id.startswith("breadbox/"):
            dataset_id = dataset_id[len("breadbox/") :]

        mapping[dataset.taiga_id] = dataset_id

    return mapping


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
        try:
            logger.warning(f"get predictions start")
            dataset_id_by_taiga_id = get_taiga_to_bb_dataset_id()
            logger.warning(f"created taiga_id -> dataset_id mapping")

            data_by_screen_type = {}
            for screen_type in SCREEN_TYPES:
                (
                    actuals_dataset_id,
                    actuals_given_id,
                    predictions_dataset_id,
                ) = translate_to_bb_ids_hack(screen_type, gene_symbol)

                logger.warning(f"fetching {screen_type}")
                # dataset = DependencyDataset.get_dataset_by_data_type_priority(
                #     screen_type
                # )

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
                for i, model in enumerate(MODEL_SEQUENCE):
                    predictions_dataset_id = get_prediction_dataset_id_hack(
                        model, screen_type, entity_id, dataset_id_by_taiga_id
                    )

                    logger.warning(f"model {model}")
                    feature_summaries = get_top_feature_summaries(
                        dataset_id_by_taiga_id=dataset_id_by_taiga_id,
                        entity_id=entity_id,
                        model=model,
                        screen_type=screen_type,
                    )
                    # this data structure is a little convoluted. Can we simplify?
                    # maybe we should fetch all the data and then restructure it?
                    r = agg_scores["accuracies"]["accuracy"][i]
                    model_performance_info[model] = ModelPerformanceInfo(
                        r=r,
                        feature_summaries=feature_summaries,
                        actuals_given_id=actuals_given_id,
                        actuals_dataset_id=actuals_dataset_id,
                        predictions_dataset_id=predictions_dataset_id,
                        predictions_given_id=actuals_given_id,  # the feature is the same in both datasets
                    )
                    logger.warning(f"feature_summaries={feature_summaries}")

                # Convert gene_tea_symbols to proper GeneTeaSearchTerm objects
                gene_tea_search_terms = [
                    GeneTeaSearchTerm(
                        name=item["name"],
                        feature_type_label=item["feature_type_label"],
                        importance_rank=item["importance_rank"],
                    )
                    for item in gene_tea_symbols
                ]

                data_by_screen_type[screen_type] = ScreenTypeData(
                    overview=OverviewData(
                        aggregated_scores=agg_scores,  # used by "Aggregate Scores Across All Models" figure
                        top_features=top_features,  # used by "Top features overall" figure
                        gene_tea_symbols=gene_tea_search_terms,  # used by GeneTEA results tab
                    ),
                    model_performance_info=model_performance_info,  # used by model performance section
                )

            result = PredictabilityData(data=PredData(__root__=data_by_screen_type))
        except Exception as e:
            logger.exception("Exception occurred")
            result = PredictabilityData(
                data=PredData(__root__={}), error_message=str(e)
            )

        return result.dict()


def translate_to_bb_ids_hack(screen_type: str, model_name: str, entity_label: str):
    # TODO: remove the need for this function
    # ideally we should be able to move to using breadbox IDs at this point, and start including those in these
    # endpoints instead of relying on gene symbols and screen names. The code below are making some assumptions
    # which may not be true in the future
    given_id = str(Gene.get_by_label(entity_label).entrez_id)
    dataset = DependencyDataset.get_dataset_by_data_type_priority(screen_type)

    return str(dataset.name.value), given_id


def get_prediction_dataset_id_hack(
    model_name, screen_type, entity_id, dataset_id_by_taiga_id: dict[str, str]
):
    # find the prediction dataset

    predictive_model = PrototypePredictiveModel.get_by_model_name_and_screen_type_and_entity_id(
        model_name=model_name, screen_type=screen_type, entity_id=entity_id
    )
    return dataset_id_by_taiga_id[predictive_model.predictions_dataset_taiga_id]


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
            feature_index=int(feature_index),
            feature_name=feature_name_type,
            screen_type=screen_type,
            entity_id=int(entity_id),
            matrix_datasets=matrix_datasets,
        )

        return plot
