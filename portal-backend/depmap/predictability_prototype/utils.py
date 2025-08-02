import functools
from http.client import HTTPException
import math
from typing import Any, Dict, List
from depmap.data_access import interface as data_access
from depmap.predictability_prototype import hacks
from depmap.predictability_prototype.models import (
    PrototypePredictiveModel,
    PrototypePredictiveFeature,
    PrototypePredictiveFeatureResult,
)
from depmap_compute import analysis_tasks_interface
from depmap.enums import DependencyEnum
import pandas as pd
import numpy as np
import re
from scipy import stats

MODEL_SEQUENCE = ["CellContext", "DriverEvents", "GeneticDerangement", "DNA", "RNASeq"]
SCREEN_TYPES = ["crispr", "rnai"]
IMPORTANCE_CUTOFF = 0.1


def get_dataset_by_model_name_and_screen_type_and_entity_id(
    model_name: str, screen_type: str, entity_id: int, matrix_datasets: list
):
    predictive_model = PrototypePredictiveModel.get_by_model_name_and_screen_type_and_entity_id(
        model_name=model_name, screen_type=screen_type, entity_id=entity_id
    )
    for dataset in matrix_datasets:
        if dataset.taiga_id == predictive_model.predictions_dataset_taiga_id:
            return dataset

    raise Exception(
        f"Could not find dataset for model_name={model_name} screen_type={screen_type} entity_id={entity_id} taiga_id={predictive_model.predictions_dataset_taiga_id}"
    )


def get_all_datasets(matrix_datasets):
    all_predictability_datasets = {}
    for dataset in matrix_datasets:
        all_predictability_datasets[dataset.taiga_id] = dataset

    return all_predictability_datasets


@functools.cache
def get_gene_effect_df(dataset):
    dataset_name = dataset.name.name

    gene_effect_df = data_access.get_subsetted_df_by_labels(dataset_name, None, None)

    return gene_effect_df.transpose()


def get_column_by_gene(df, symbol) -> pd.Series:
    column_name = [x for x in df.columns if x == symbol.split(" ")[0]]
    assert len(column_name) == 1, f"Expected one matching column: {column_name}"
    return df[column_name[0]]


def pairwise_complete_pearson_cor(x, y):
    # find which observations have a value for both
    pairwise_complete = (~pd.isna(x)) & (~pd.isna(y))
    # compute correlation over those observations
    return np.corrcoef(x[pairwise_complete], y[pairwise_complete])[0, 1]


def accuracy_per_model(entity_id, screen_type):
    accuracies = []

    feature_highest_importance_by_model = {}

    predictive_models = PrototypePredictiveModel.find_by_screen_type(
        screen_type=screen_type, entity_id=entity_id
    )
    predictive_models_by_model_label: Dict[str, PrototypePredictiveModel] = {
        predictive_model.label: predictive_model
        for predictive_model in predictive_models
    }

    feature_labels_by_model = PrototypePredictiveModel.get_features_added_per_model(
        MODEL_SEQUENCE, entity_id
    )

    for model_name in MODEL_SEQUENCE:
        predictive_model = predictive_models_by_model_label[model_name]

        accuracy = predictive_model.pearson

        feature_highest_importance_by_model[
            model_name
        ] = _get_feature_highest_importance(
            feature_labels_by_model, model_name, entity_id, screen_type
        )

        accuracies.append(accuracy)

    return dict(
        name=MODEL_SEQUENCE,
        accuracy=accuracies,
        feature_highest_importance=feature_highest_importance_by_model,
    )


def _get_feature_highest_importance(
    feature_labels_by_model, model_name, entity_id, screen_type
):
    # PRED-FIXME: I'm not entirely sure I understand this logic
    unique_model_features = feature_labels_by_model[model_name]
    summaries = PrototypePredictiveModel.get_predictive_model_feature_summaries(
        model_name=model_name, entity_id=entity_id, screen_type=screen_type
    )
    features_importances = [(x.feature_label, x.importance) for x in summaries]

    features_above_threshold = [
        feat_imp[0]
        for feat_imp in features_importances
        if feat_imp[1] > IMPORTANCE_CUTOFF
    ]

    highest_importance_candidates = [
        feat for feat in features_above_threshold if feat in unique_model_features
    ]

    return (
        None
        if len(highest_importance_candidates) < 1
        else highest_importance_candidates
    )


class AccuracyPerModel:
    x_axis_label: str
    y_axis_label: str
    accuracies: List[float]


def generate_aggregate_scores_across_all_models(
    entity_id, screen_type,
):
    accuracies = accuracy_per_model(entity_id, screen_type)
    return {
        "accuracies": accuracies,
        "x_axis_label": "name",
        "y_axis_label": "accuracy",
    }


def subset_features_by_gene(gene_symbol, screen_type):
    features_df = PrototypePredictiveModel.get_by_entity_label_and_screen_type(
        gene_symbol, screen_type
    )

    return features_df.reset_index(drop=True)


def aggregate_top_features(df: pd.DataFrame):
    aggregate_feature_importance = lambda df: (df["pearson"] * df["importance"]).sum()

    grouped_df = df.groupby(["feature_name", "dim_type", "feature_label"])
    aggregated = grouped_df.apply(aggregate_feature_importance)
    assert isinstance(aggregated, pd.Series)
    return aggregated.sort_values(ascending=False)  # pyright: ignore


def top_features_overall(gene_symbol, entity_id, screen_type):
    subsetted_features = subset_features_by_gene(gene_symbol, screen_type)
    adj_feature_importance = aggregate_top_features(subsetted_features)

    adj_feature_importance = adj_feature_importance.reset_index()
    adj_feature_importance = adj_feature_importance.set_index("feature_name")
    assert adj_feature_importance.index.is_unique

    df_100 = pd.DataFrame(
        dict(
            feature=adj_feature_importance.index,
            feature_label=adj_feature_importance["feature_label"].values.tolist(),
            dim_type=adj_feature_importance["dim_type"].values.tolist(),
            adj_feature_importance=adj_feature_importance[0].values.tolist(),
        )
    ).head(100)

    feature_types_by_model = PrototypePredictiveModel.get_feature_types_added_per_model(
        MODEL_SEQUENCE, entity_id, screen_type
    )

    def get_feature_set(feature_type: str):
        for key, val in feature_types_by_model.items():
            if feature_type in val:
                return key

    unique_gene_symbols = [
        {
            "name": row["feature_label"],
            "feature_type_label": str(row["feature"]).split("_")[-1],
            "importance_rank": i + 1,
        }
        for i, (_, row) in enumerate(df_100.iterrows())
        if row["dim_type"] == "gene"
    ]

    df = df_100.head(10)

    df["dim_type"] = [x for x in df["dim_type"]]
    # FIXME: df['feature_type'] does not exist. Hardcoding to CellContext for now
    # df["feature_set"] = [get_feature_set(x) for x in df["feature_type"]]
    df["feature_set"] = ["CellContext" for x in df["dim_type"]]
    df["feature"] = [x.replace("_", " ") for x in df["feature"]]
    df["feature_label"] = df["feature_label"].values

    # TODO: Replace this with real mapping of model_name to feature. This is just a short cut
    # for the prototype.
    index_tracker = 0
    model_names_list = []
    for _ in range(len(df["feature"].values)):
        model_names_list.append(MODEL_SEQUENCE[index_tracker])
        if index_tracker < len(MODEL_SEQUENCE) - 1:
            index_tracker += 1
        else:
            index_tracker = 0

    df["model_name"] = model_names_list

    top_features = {
        "data": df.to_dict("list"),
        "x_axis_label": "adj_feature_importance",
        "y_axis_label": "feature",
    }

    return top_features, unique_gene_symbols


def get_density(x: Any, y: Any):
    values = np.vstack([x, y])
    kernel = stats.gaussian_kde(values)
    density = kernel(values)
    return density


def generate_model_predictions(
    gene_symbol: str,
    screen_type: str,
    model: str,
    actuals: pd.DataFrame,
    entity_id: int,
    matrix_datasets: list,
):
    dataset = get_dataset_by_model_name_and_screen_type_and_entity_id(
        model_name=model,
        screen_type=screen_type,
        entity_id=entity_id,
        matrix_datasets=matrix_datasets,
    )

    gene_predictions = data_access.get_row_of_values(
        dataset_id=dataset.id, feature=gene_symbol
    )
    gene_actuals = get_column_by_gene(actuals, gene_symbol)

    model_ids = gene_actuals.dropna().index.tolist()
    prediction_model_ids = gene_predictions.dropna().index.tolist()
    # Finding this intersection is temporary due to the sample predictability
    # data using 23q4 data, but working with a copy of the 24q2 database.
    allowed_model_ids = list(set(model_ids) & set(prediction_model_ids))

    gene_predictions = gene_predictions.dropna().loc[allowed_model_ids]
    gene_actuals = gene_actuals.dropna().loc[allowed_model_ids]

    data = pd.DataFrame(dict(predictions=gene_predictions, actuals=gene_actuals))
    density = get_density(gene_predictions, gene_actuals)
    model_id_to_display_name_map = data_access.get_dataset_sample_labels_by_id(
        dataset.id
    )

    return {
        "model_pred_data": data.to_dict("list"),
        "predictions_dataset_id": dataset.id,
        "index_labels": [
            model_id_to_display_name_map[model_id] for model_id in data.index.tolist()
        ],
        "x_label": "actuals",
        "y_label": "predictions",
        "density": list(density),
        "model": model,
    }


def get_dataset_id_from_taiga_id(
    model: str, screen_type: str, feature_name: str, matrix_datasets: list
):

    (
        taiga_id,
        feature_given_id,
    ) = PrototypePredictiveFeature.get_taiga_id_from_feature_name(
        model, feature_name, screen_type
    )

    feature_dataset_id = None

    for dataset in matrix_datasets:
        if dataset.taiga_id == taiga_id and data_access.is_breadbox_id(dataset.id):
            feature_dataset_id = dataset.id
            break

    assert feature_dataset_id is not None, f"{taiga_id}, {feature_name}"

    return feature_dataset_id


def get_dataset_from_taiga_id(
    model: str, screen_type: str, feature_name: str, matrix_datasets: list
):

    (
        taiga_id,
        feature_given_id,
    ) = PrototypePredictiveFeature.get_taiga_id_from_feature_name(
        model, feature_name, screen_type
    )

    for dataset in matrix_datasets:
        if dataset.taiga_id == taiga_id:
            return dataset

    raise Exception("Dataset not found")


def get_feature_slice_and_dataset_id(
    screen_type: str,
    feature_name: str,
    feature_given_id: str,
    model: str,
    matrix_datasets: list,
):

    feature_dataset_id = get_dataset_id_from_taiga_id(
        model=model,
        screen_type=screen_type,
        feature_name=feature_name,
        matrix_datasets=matrix_datasets,
    )

    slice = data_access.get_row_of_values(
        feature_dataset_id, str(feature_given_id), feature_identifier="id"
    )

    return slice.dropna(), feature_dataset_id


def get_top_feature_headers(entity_id: int, model: str, screen_type: str):
    summaries = PrototypePredictiveModel.get_predictive_model_feature_summaries(
        model_name=model, entity_id=entity_id, screen_type=screen_type
    )
    summaries = sorted(summaries, key=lambda x: x.rank)

    top_features_metadata = {}
    for feature_info in summaries[:10]:
        feature_name = feature_info.feature_name
        dim_type = feature_info.dim_type
        feature_label = feature_info.feature_label

        feature_importance = feature_info.importance
        pearson = feature_info.pearson

        feature_obj = PrototypePredictiveFeature.get_by_feature_name(feature_name)
        assert feature_obj is not None
        related_type = feature_obj.get_relation_to_entity(entity_id=entity_id)

        top_features_metadata[feature_name] = {
            "feature_label": feature_label,
            "feature_importance": feature_importance,
            "feature_type": feature_name.split("_")[-1],
            "dim_type": dim_type,  # For data explorer button
            "pearson": pearson,
            "related_type": related_type,
        }

    return top_features_metadata


def get_top_features(
    entity_id: int, model: str, screen_type: str, matrix_datasets: list
):
    summaries = PrototypePredictiveModel.get_predictive_model_feature_summaries(
        model_name=model, entity_id=entity_id, screen_type=screen_type
    )
    summaries = sorted(summaries, key=lambda x: x.rank)

    top_features = {}
    top_features_metadata = {}

    for feature_info in summaries[:10]:
        feature_name = feature_info.feature_name
        feature_given_id = feature_info.given_id
        dim_type = feature_info.dim_type
        feature_label = feature_info.feature_label

        (slice, feature_dataset_id) = get_feature_slice_and_dataset_id(
            screen_type=screen_type,
            feature_name=feature_name,
            feature_given_id=feature_given_id,
            model=model,
            matrix_datasets=matrix_datasets,
        )

        feature_importance = feature_info.importance
        pearson = feature_info.pearson

        slice = slice.dropna()
        top_features[feature_name] = slice

        top_features_metadata[feature_name] = {
            "feature_name": feature_name,
            "feature_label": feature_label,
            "feature_actuals_values": slice.values.tolist(),
            "feature_actuals_value_labels": slice.index.tolist(),
            "feature_dataset_id": feature_dataset_id,
            "feature_importance": feature_importance,
            "feature_type": feature_name.split("_")[-1],
            "dim_type": dim_type,  # For data explorer button
            "pearson": pearson,
        }

    return {
        "top_features": top_features,
        "metadata": top_features_metadata,
    }


def _get_gene_dataset_id(screen_type: str):
    return (
        DependencyEnum.Chronos_Combined.name
        if screen_type == "crispr"
        else DependencyEnum.RNAi_merged.name
    )


def get_feature_gene_effect_plot_data(
    model: str,
    entity_id: int,
    gene_symbol: str,
    feature_index: int,
    feature_name: str,
    screen_type: str,
    matrix_datasets: list,
):
    # Use entity_id instead of label for consistency between the portal release
    # datasets and Breadbox. If a gene has 2 symbols, using the entity_id ensures
    # both symbols will map to the proper entity in the PrototypePredictiveModel table.
    summaries_ = PrototypePredictiveModel.get_predictive_model_feature_summaries(
        model_name=model, entity_id=entity_id, screen_type=screen_type
    )
    # It's a little odd to filter out by rank after the query. Maybe make the query above take feature_index (rank) as a parameter?
    summaries = [x for x in summaries_ if x.rank == feature_index]
    assert (
        len(summaries) == 1
    ), f"Expected 1 but found {len(summaries)} rows with rank {feature_index}: {summaries_}"
    feature = summaries[0]

    gene_dataset_id = _get_gene_dataset_id(screen_type)
    gene_series = data_access.get_row_of_values(gene_dataset_id, gene_symbol)

    feature_name = feature.feature_name
    given_id = feature.given_id
    feature_label = feature.feature_label

    slice, feature_dataset_id = get_feature_slice_and_dataset_id(
        screen_type=screen_type,
        feature_name=feature_name,
        feature_given_id=given_id,
        model=model,
        matrix_datasets=matrix_datasets,
    )

    value_labels = slice.index.tolist()
    values = slice.values.tolist()

    # PRED-FIXME: see below
    # TEMP HACK FOR PROTOTYPE
    values, value_labels = hacks.get_value_labels_temp_hack(
        gene_series, value_labels, values
    )

    gene_slice = gene_series.replace(np.nan, None).loc[value_labels].values.tolist()

    feature_values = [0 if math.isnan(x) else x for x in values]

    if len(set(feature_values)) <= 1:
        density = feature_values
    else:
        density = get_density(feature_values, gene_slice)

    feature_dataset_units = data_access.get_dataset_units(feature_dataset_id)
    model_ids_to_display_name_map = data_access.get_dataset_sample_labels_by_id(
        feature_dataset_id
    )

    # broken out to appease pyright
    feature_actuals_value_labels = []
    for model_id in slice.index.tolist():
        assert isinstance(model_id, str)
        display_name = model_ids_to_display_name_map.get(model_id)
        feature_actuals_value_labels.append(display_name)

    return {
        "actuals_slice": gene_slice,
        "feature_dataset_id": feature_dataset_id,
        "feature_actuals_values": slice.values.tolist(),
        "feature_actuals_value_labels": feature_actuals_value_labels,
        "density": list(density),
        "x_axis_label": f"{feature_label}<br>{feature_dataset_units}",
        "y_axis_label": f"{gene_symbol} Gene Effect",
    }


def get_feature_boxplot_data(
    screen_type: str,
    feature_name: str,
    entity_label: str,
    model: str,
    matrix_datasets: list,
):
    feature = PrototypePredictiveFeatureResult.get_feature_result(
        model_name=model,
        entity_label=entity_label,
        screen_type=screen_type,
        feature_name=feature_name,
    )

    feature_name = feature["feature_name"].values[0]
    given_id = feature["given_id"].values[0]

    slice, _ = get_feature_slice_and_dataset_id(
        screen_type=screen_type,
        feature_name=feature_name,
        feature_given_id=given_id,
        model=model,
        matrix_datasets=matrix_datasets,
    )

    # TODO:
    slice_vals = slice.dropna().values.tolist()

    is_binary = (
        min(slice_vals) == 0
        and max(slice_vals) == 1
        or min(slice_vals) == 0
        and max(slice_vals) == 0
        or min(slice_vals) == 1
        and max(slice_vals) == 1
    )

    if is_binary:
        frac_0 = slice_vals.count(0) / len(slice_vals)
        frac_1 = slice_vals.count(1) / len(slice_vals)
        data = {"fraction_0": frac_0, "fraction_1": frac_1}
        return {"data": data, "is_binary": is_binary}

    return {"data": slice.dropna().values.tolist(), "is_binary": is_binary}


def feature_correlation_map_calc(
    model, entity_id, screen_type: str, matrix_datasets: list
):
    top_features_and_metadata = get_top_features(
        screen_type=screen_type,
        entity_id=entity_id,
        model=model,
        matrix_datasets=matrix_datasets,
    )

    top_features = top_features_and_metadata["top_features"]
    top_features_metadata = top_features_and_metadata["metadata"]
    df = pd.DataFrame(top_features)
    metadata_df = pd.DataFrame(top_features_metadata)

    df = df.corr()

    row_labels = df.index.tolist()
    values = df.replace(np.nan, None).values.tolist()

    gene_symbol_feature_types = {}
    feature_names = []
    feature_types = []

    for feature_name in list(top_features.keys()):
        feature = PrototypePredictiveFeature.get_by_feature_name(feature_name)

        assert feature is not None

        feature_name = feature.feature_name
        feature_type = feature.dim_type
        feature_names.append(feature_name)
        feature_types.append(feature_type)

        if feature_type == "gene":
            gene_symbol_feature_types[feature_name] = feature_type

    return {
        "corr": {
            "corr_heatmap_vals": values,
            "row_labels": row_labels,
            "gene_symbol_feature_types": gene_symbol_feature_types,
            "feature_names": feature_names,
            "feature_types": feature_types,
        },
        "metadata": metadata_df,
    }


def get_pearson_corr(df, slice):
    def progress_callback(percentage):
        return

    df, slice = df.align(slice, axis=1)

    (x, _, _, _) = analysis_tasks_interface.prep_and_run_py_pearson(
        slice.values, df.values, progress_callback
    )

    return x


def get_other_feature_corrs(feature_df, feature_slice):
    corr = get_pearson_corr(feature_df, feature_slice)

    return corr


def get_ge_corrs(ge_slice, feature_df, screen_type):

    corr = get_pearson_corr(feature_df, ge_slice)

    return corr


def get_related_features_scatter(
    gene_symbol,
    feature_label,
    feature_type,
    feature_slice_values,
    feature_slice_index,
    feature_dataset_id,
    screen_type,
):
    feature_df = data_access.get_subsetted_df_by_labels(
        feature_dataset_id, None, feature_slice_index
    )
    feature_df = feature_df.dropna()

    x = get_other_feature_corrs(
        feature_df=feature_df,
        feature_slice=pd.Series(index=feature_slice_index, data=feature_slice_values,),
    )

    gene_dataset_id = _get_gene_dataset_id(screen_type)
    ge_slice = data_access.get_row_of_values(gene_dataset_id, gene_symbol)
    y = get_ge_corrs(ge_slice=ge_slice, feature_df=feature_df, screen_type=screen_type)

    x = np.nan_to_num(x)
    y = np.nan_to_num(y)

    density = get_density(x, y)

    x_label = "Other %s R<br>with %s" % (feature_type, feature_label)
    y_label = "Other %s R<br>with %s Gene Effect" % (feature_type, gene_symbol)

    return {
        "x": list(x),
        "x_index": feature_df.index.tolist(),
        "y": list(y),
        "density": list(density),
        "x_label": x_label,
        "y_label": y_label,
    }


def get_feature_corr_plot(
    model,
    gene_symbol,
    entity_id,
    feature_name_type,
    screen_type: str,
    matrix_datasets: list,
):
    top_features = get_top_features(
        screen_type=screen_type,
        entity_id=entity_id,
        model=model,
        matrix_datasets=matrix_datasets,
    )
    full_feature_info = top_features["metadata"][feature_name_type]

    feature_dataset_id = full_feature_info["feature_dataset_id"]

    rel_features_scatter_plot = None

    if data_access.is_continuous(feature_dataset_id):
        rel_features_scatter_plot = get_related_features_scatter(
            gene_symbol=gene_symbol,
            feature_label=full_feature_info["feature_label"],
            feature_type=full_feature_info["feature_type"],
            feature_slice_values=full_feature_info["feature_actuals_values"],
            feature_slice_index=full_feature_info["feature_actuals_value_labels"],
            feature_dataset_id=full_feature_info["feature_dataset_id"],
            screen_type=screen_type,
        )

    return rel_features_scatter_plot
