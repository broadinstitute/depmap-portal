import functools
import math
from depmap.data_access import interface as data_access
from depmap.dataset.models import DependencyDataset
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


def get_dataset_by_model_name(model_name: str, screen_type: str):
    matrix_datasets = data_access.get_all_matrix_datasets()
    for dataset in matrix_datasets:
        if screen_type == "crispr":
            if (
                hacks.DATASET_TAIGA_IDS_BY_MODEL_NAME_CRISPR[model_name]
                == dataset.taiga_id
            ):
                return dataset
        elif screen_type == "rnai":
            if (
                hacks.DATASET_TAIGA_IDS_BY_MODEL_NAME_RNAI[model_name]
                == dataset.taiga_id
            ):
                return dataset

    raise Exception(f"Could not find dataset for {model_name}")


@functools.cache
def get_all_predictability_datasets():
    all_predictability_datasets = {}
    matrix_datasets = data_access.get_all_matrix_datasets()
    for dataset in matrix_datasets:
        if dataset.data_type == "Predictability":
            all_predictability_datasets[dataset.taiga_id] = dataset

    return all_predictability_datasets


@functools.cache
def get_gene_effect_df(screen_type="crispr"):
    dataset_name = DependencyDataset.get_dataset_by_data_type_priority(
        screen_type
    ).name.name

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


def accuracy_per_model(gene_symbol, entity_id, screen_type, datasets, actuals):
    gene_actuals = get_column_by_gene(actuals, gene_symbol)
    accuracies = []

    feature_highest_importance_by_model = {}

    feature_labels_by_model = PrototypePredictiveModel.get_features_added_per_model(
        MODEL_SEQUENCE, entity_id
    )

    for model_name in MODEL_SEQUENCE:
        prediction_dataset_id = datasets[
            hacks.get_dataset_taiga_id_by_model_and_screen_type(
                model_name=model_name, screen_type=screen_type
            )
        ].id

        gene_predictions = data_access.get_row_of_values(
            prediction_dataset_id, gene_symbol,
        )

        accuracy = pairwise_complete_pearson_cor(gene_predictions, gene_actuals)

        unique_model_features = feature_labels_by_model[model_name]
        gene_row = PrototypePredictiveModel.get_entity_row(
            model_name=model_name, entity_id=entity_id, screen_type=screen_type
        )
        features = gene_row["feature_label"].values.tolist()

        highest_importance_candidates = list(set(unique_model_features) - set(features))

        feature_highest_importance_by_model[model_name] = (
            None
            if len(highest_importance_candidates) < 1
            else highest_importance_candidates[0]
        )

        accuracies.append(accuracy)

    return dict(
        name=MODEL_SEQUENCE,
        accuracy=accuracies,
        feature_highest_importance=feature_highest_importance_by_model,
    )


def generate_aggregate_scores_across_all_models(
    gene_symbol, entity_id, screen_type, datasets, actuals
):
    accuracies = accuracy_per_model(
        gene_symbol, entity_id, screen_type, datasets, actuals
    )
    return {
        "accuracies": accuracies,
        "x_axis_label": "name",
        "y_axis_label": "accuracy",
    }


def subset_features_by_gene(gene_symbol):
    features_df = PrototypePredictiveModel.get_by_entity_label(gene_symbol)

    return features_df.reset_index(drop=True)


def aggregate_top_features(df: pd.DataFrame):
    aggregate_feature_importance = lambda df: (df["pearson"] * df["importance"]).sum()

    grouped_df = df.groupby(["feature_name", "dim_type", "feature_label"])
    aggregated = grouped_df.apply(aggregate_feature_importance)

    return aggregated.sort_values(ascending=False)


def top_features_overall(gene_symbol, entity_id):
    subsetted_features = subset_features_by_gene(gene_symbol)
    adj_feature_importance = aggregate_top_features(subsetted_features)

    adj_feature_importance = adj_feature_importance.reset_index()
    adj_feature_importance = adj_feature_importance.set_index("feature_name")
    assert adj_feature_importance.index.is_unique

    df = pd.DataFrame(
        dict(
            feature=adj_feature_importance.index,
            feature_label=adj_feature_importance["feature_label"].values.tolist(),
            dim_type=adj_feature_importance["dim_type"].values.tolist(),
            adj_feature_importance=adj_feature_importance[0].values.tolist(),
        )
    ).head(10)

    feature_types_by_model = PrototypePredictiveModel.get_feature_types_added_per_model(
        MODEL_SEQUENCE, entity_id
    )

    def get_feature_set(feature_type: str):
        for key, val in feature_types_by_model.items():
            if feature_type in val:
                return key

    df["feature_type"] = [x for x in df["dim_type"]]
    df["feature_set"] = [get_feature_set(x) for x in df["feature_type"]]
    df["feature"] = [x.replace("_", " ") for x in df["feature"]]
    df["feature_label"] = df["feature_label"].values
    unique_gene_symbols = [
        x
        for index, x in enumerate(df["feature_label"])
        if df["dim_type"].iloc[index] == "gene"
    ]

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


def get_density(x: np.ndarray, y: np.ndarray):
    values = np.vstack([x, y])
    kernel = stats.gaussian_kde(values)
    density = kernel(values)
    return density


def generate_model_predictions(
    gene_symbol: str, screen_type: str, model: str, actuals: pd.DataFrame
):
    dataset = get_dataset_by_model_name(model_name=model, screen_type=screen_type)

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

    return {
        "model_pred_data": data.to_dict("list"),
        "predictions_dataset_id": dataset.id,
        "cell_lines": gene_predictions.index.tolist(),
        "x_label": "actuals",
        "y_label": "predictions",
        "density": list(density),
        "model": model,
    }


def get_feature_dataset_feature_type_from_taiga_id(taiga_id: str):
    matrix_datasets = data_access.get_all_matrix_datasets()
    feature_type = None

    for dataset in matrix_datasets:
        if dataset.taiga_id == taiga_id and dataset.data_type == "Predictability":
            feature_type = dataset.feature_type
            break

    return feature_type


def get_dataset_id_from_taiga_id(model: str, screen_type: str, feature_name: str):

    (
        taiga_id,
        feature_given_id,
    ) = PrototypePredictiveFeature.get_taiga_id_from_feature_name(
        model, feature_name, screen_type
    )

    matrix_datasets = data_access.get_all_matrix_datasets()
    feature_dataset_id = None

    for dataset in matrix_datasets:
        if dataset.taiga_id == taiga_id and dataset.data_type == "Predictability":
            feature_dataset_id = dataset.id
            break

    assert feature_dataset_id is not None, f"{taiga_id}, {feature_name}"

    return feature_dataset_id


def get_feature_slice_and_dataset_id(
    screen_type: str, feature_name: str, feature_given_id: str, model: str
):

    feature_dataset_id = get_dataset_id_from_taiga_id(
        model=model, screen_type=screen_type, feature_name=feature_name
    )

    slice = data_access.get_row_of_values(
        feature_dataset_id, str(feature_given_id), feature_identifier="id"
    )

    return slice.dropna(), feature_dataset_id


def get_top_feature_headers(entity_id: int, model: str, screen_type: str):
    feature_df = PrototypePredictiveModel.get_entity_row(
        model_name=model, entity_id=entity_id, screen_type=screen_type
    )

    top_features_metadata = {}
    for i in range(0, 10):
        if len(feature_df.loc[feature_df["rank"] == i]) == 0:
            continue
        feature_info = feature_df.loc[feature_df["rank"] == i].to_dict("records")[0]
        feature_name = feature_info["feature_name"]
        feature_type = feature_info["dim_type"]
        feature_label = feature_info["feature_label"]

        feature_importance = feature_info["importance"]
        pearson = feature_info["pearson"]
        taiga_id = feature_info["taiga_id"]
        dataset_feature_type_label = get_feature_dataset_feature_type_from_taiga_id(
            taiga_id
        )

        top_features_metadata[feature_name] = {
            "feature_name": feature_label,
            "feature_importance": feature_importance,
            "feature_type": feature_type,
            "pearson": pearson,
            "dataset_feature_type_label": dataset_feature_type_label,
        }

    return top_features_metadata


# Index(['feature_label', 'given_id', 'importance', 'rank', 'pearson', 'entity'], dtype='object')
def get_top_features(entity_id: int, model: str, screen_type: str):
    feature_df = PrototypePredictiveModel.get_entity_row(
        model_name=model, entity_id=entity_id, screen_type=screen_type
    )

    top_features = {}
    top_features_metadata = {}

    for i in range(0, 10):
        if len(feature_df.loc[feature_df["rank"] == i]) == 0:
            continue
        feature_info = feature_df.loc[feature_df["rank"] == i].to_dict("records")[0]
        feature_name = feature_info["feature_name"]
        feature_given_id = feature_info["given_id"]
        feature_type = feature_info["dim_type"]
        feature_label = feature_info["feature_label"]

        (slice, feature_dataset_id) = get_feature_slice_and_dataset_id(
            screen_type=screen_type,
            feature_name=feature_name,
            feature_given_id=feature_given_id,
            model=model,
        )

        feature_importance = feature_info["importance"]
        pearson = feature_info["pearson"]

        slice = slice.dropna()
        top_features[feature_label] = slice

        top_features_metadata[feature_name] = {
            "feature_name": feature_label,
            "feature_actuals_values": slice.values.tolist(),
            "feature_actuals_value_labels": slice.index.tolist(),
            "feature_dataset_id": feature_dataset_id,
            "feature_importance": feature_importance,
            "feature_type": feature_type,
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
):
    # Use entity_id instead of label for consistency between the portal release
    # datasets and Breadbox. If a gene has 2 symbols, using the entity_id ensures
    # both symbols will map to the proper entity in the PrototypePredictiveModel table.
    row = PrototypePredictiveModel.get_entity_row(
        model_name=model, entity_id=entity_id, screen_type=screen_type
    )

    gene_series = data_access.get_row_of_values(
        _get_gene_dataset_id(screen_type), gene_symbol
    )

    feature = row.iloc[[feature_index]]

    feature_name = feature["feature_name"].values[0]
    given_id = feature["given_id"].values[0]
    feature_label = feature["feature_label"].values[0]

    slice, feature_dataset_id = get_feature_slice_and_dataset_id(
        screen_type=screen_type,
        feature_name=feature_name,
        feature_given_id=given_id,
        model=model,
    )

    value_labels = slice.index.tolist()
    values = slice.values.tolist()

    # TEMP HACK FOR PROTOTYPE
    values, value_labels = hacks.get_value_labels_temp_hack(
        gene_series, value_labels, values
    )

    gene_slice = gene_series.replace(np.nan, None).loc[value_labels].values.tolist()

    feature_values = [0 if math.isnan(x) else x for x in values]

    if len(set(feature_values)) <= 1:
        density = feature_values
    else:
        density = get_density(np.ndarray(feature_values), gene_slice)

    feature_dataset_units = data_access.get_dataset_units(feature_dataset_id)

    return {
        "actuals_slice": gene_slice,
        "feature_dataset_id": feature_dataset_id,
        "feature_actuals_values": slice.values.tolist(),
        "feature_actuals_value_labels": slice.index.tolist(),
        "density": list(density),
        "x_axis_label": f"{feature_label}<br>{feature_dataset_units}",
        "y_axis_label": f"{gene_symbol} Gene Effect",
    }


def get_feature_boxplot_data(
    screen_type: str, feature_name: str, entity_label: str, model: str,
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
    )

    return slice.dropna().values.tolist()


def feature_correlation_map_calc(model, entity_id, screen_type: str):
    top_features_and_metadata = get_top_features(
        screen_type=screen_type, entity_id=entity_id, model=model
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

    for feature_label in list(top_features.keys()):
        feature = PrototypePredictiveFeature.get_by_feature_label(feature_label)

        assert feature is not None

        feature_name = feature.feature_name
        feature_type = feature.dim_type
        feature_names.append(feature_name)
        feature_types.append(feature_type)

        if feature_type == "gene":
            gene_symbol_feature_types[feature_label] = feature_type

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


def get_ge_corrs(gene, feature_df, screen_type):
    ge_slice = data_access.get_row_of_values(_get_gene_dataset_id(screen_type), gene)

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

    import time

    start = time.time()
    x = get_other_feature_corrs(
        feature_df=feature_df,
        feature_slice=pd.Series(index=feature_slice_index, data=feature_slice_values,),
    )
    end = time.time()
    print(f"get_other_feature_corrs {end-start} seconds")

    start = time.time()
    y = get_ge_corrs(gene=gene_symbol, feature_df=feature_df, screen_type=screen_type)

    x = np.nan_to_num(x)
    y = np.nan_to_num(y)

    density = get_density(x, y)
    end = time.time()
    print(f"get_ge_corrs and get_density {end-start} seconds")

    x_label = "Other %s R<br>with %s" % (feature_type, feature_label)
    y_label = "Other %s R<br>with %s Gene Effect" % (feature_type, gene_symbol)

    return {
        "x": list(x),
        "y": list(y),
        "density": list(density),
        "x_label": x_label,
        "y_label": y_label,
    }


def get_other_dep_waterfall_plot(
    feature_label,
    feature_type,
    feature_slice_values,
    feature_slice_index,
    screen_type: str,
):
    gene_df = data_access.get_subsetted_df_by_labels(
        _get_gene_dataset_id(screen_type), None, feature_slice_index
    )

    gene_df = gene_df.dropna()

    import time

    start = time.time()
    feature_series = pd.DataFrame(data=feature_slice_values, index=feature_slice_index)

    def progress_callback(percentage):
        return

    gene_df, feature_series = gene_df.align(feature_series, axis=1)

    (x, _, _, _) = analysis_tasks_interface.prep_and_run_py_pearson(
        feature_series.values, gene_df.values, progress_callback
    )

    end = time.time()
    print(f"CORRWITH TIME {end-start} seconds")

    # TODO confirm this method returns proper results. Example used corrwith but that
    # was 2x as slow as just using apply with np.corrcoef.

    x = list(x)
    x.sort()
    y = list(range(len(x)))
    y_label = "Gene Effect R<br>with %s %s" % (feature_label, feature_type)

    return {"x": x, "y": y, "x_label": "Rank", "y_label": y_label}


def get_feature_corr_plot(
    model, gene_symbol, entity_id, feature_name_type, screen_type: str
):
    top_features = get_top_features(
        screen_type=screen_type, entity_id=entity_id, model=model
    )
    full_feature_info = top_features["metadata"][feature_name_type]

    feature_dataset_id = full_feature_info["feature_dataset_id"]

    rel_features_scatter_plot = None
    if data_access.is_continuous(feature_dataset_id):
        rel_features_scatter_plot = get_related_features_scatter(
            gene_symbol=gene_symbol,
            feature_label=full_feature_info["feature_name"],
            feature_type=full_feature_info["feature_type"],
            feature_slice_values=full_feature_info["feature_actuals_values"],
            feature_slice_index=full_feature_info["feature_actuals_value_labels"],
            feature_dataset_id=full_feature_info["feature_dataset_id"],
            screen_type=screen_type,
        )

    return rel_features_scatter_plot


def get_feature_waterfall_plot(model, entity_id, feature_name_type, screen_type: str):
    top_features = get_top_features(
        screen_type=screen_type, entity_id=entity_id, model=model
    )
    full_feature_info = top_features["metadata"][feature_name_type]

    feature_dataset_id = full_feature_info["feature_dataset_id"]

    waterfall_plot = None
    if data_access.is_continuous(feature_dataset_id):
        waterfall_plot = get_other_dep_waterfall_plot(
            feature_label=full_feature_info["feature_name"],
            feature_type=full_feature_info["feature_type"],
            feature_slice_values=full_feature_info["feature_actuals_values"],
            feature_slice_index=full_feature_info["feature_actuals_value_labels"],
            screen_type=screen_type,
        )

    return waterfall_plot
