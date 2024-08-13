import functools
import math
from tabnanny import verbose
from typing import Any, Dict, List
from depmap.data_access import interface as data_access
from depmap.celery_task.utils import format_task_status
from depmap.cell_line.models_new import DepmapModel
from depmap.data_access.breadbox_dao import get_all_matrix_dataset_ids
from depmap.dataset.models import BiomarkerDataset, Dataset, DependencyDataset
from depmap.gene.models import Gene
from depmap.interactive.views import get_datasets
from depmap.partials.matrix.models import CellLineSeries
from depmap.predictability_prototype import data_tasks
from depmap.predictability_prototype import hacks
from depmap.predictability_prototype.hacks import (
    get_dataset_id_from_feature_type,
    get_feature_type_labels_added_by_model_step,
    get_features_added_by_model_step,
)

from depmap.predictability_prototype.models import (
    PrototypePredictiveModel,
    PrototypePredictiveFeature,
    PrototypePredictiveFeatureResult,
)
from depmap.settings.download_settings import get_download_list
import pandas as pd
import numpy as np
import re
from scipy import stats

MODEL_SEQUENCE = ["CellContext", "DriverEvents", "GeneticDerangement", "DNA", "RNASeq"]


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
def get_gene_effect_df():
    dataset_name = DependencyDataset.get_dataset_by_data_type_priority(
        DependencyDataset.DataTypeEnum.crispr
    ).name.name

    gene_effect_df = data_access.get_subsetted_df_by_labels(dataset_name, None, None)

    return gene_effect_df.transpose()


def get_column_by_gene(df, symbol):
    column_name = [x for x in df.columns if x == symbol.split(" ")[0]]
    assert len(column_name) == 1, f"Expected one matching column: {column_name}"
    return df[column_name[0]]


def get_dataset_column_by_gene(dataset_id, symbol):
    gene_df = data_access.get_row_of_values(dataset_id, symbol)

    return gene_df


def pairwise_complete_pearson_cor(x, y):
    # find which observations have a value for both
    pairwise_complete = (~pd.isna(x)) & (~pd.isna(y))
    # compute correlation over those observations
    return np.corrcoef(x[pairwise_complete], y[pairwise_complete])[0, 1]


def accuracy_per_model(gene_symbol, screen_type, datasets, actuals):
    gene_actuals = get_column_by_gene(actuals, gene_symbol)
    accuracies = []

    feature_highest_importance_by_model = {}

    # TODO: temporary for prototype
    unique_features_by_model = get_features_added_by_model_step()

    for model_name in MODEL_SEQUENCE:
        gene_predictions = get_dataset_column_by_gene(
            datasets[
                hacks.get_dataset_taiga_id_by_model_and_screen_type(
                    model_name=model_name, screen_type=screen_type
                )
            ].id,
            gene_symbol,
        )

        accuracy = pairwise_complete_pearson_cor(gene_predictions, gene_actuals)

        unique_model_features = unique_features_by_model[model_name]
        gene_row = PrototypePredictiveModel.get_entity_row(
            model_name=model_name, entity_label=gene_symbol, screen_type=screen_type
        )
        features = gene_row["feature_name"].values.tolist()

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
    gene_symbol, screen_type, datasets, actuals
):
    accuracies = accuracy_per_model(gene_symbol, screen_type, datasets, actuals)
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

    aggregated = df.groupby(["feature_name", "dim_type"]).apply(
        aggregate_feature_importance
    )

    return aggregated.sort_values(ascending=False)


def top_features_overall(gene_symbol):
    subsetted_features = subset_features_by_gene(gene_symbol)
    adj_feature_importance = aggregate_top_features(subsetted_features)

    adj_feature_importance = adj_feature_importance.reset_index()
    adj_feature_importance = adj_feature_importance.set_index("feature_name")
    assert adj_feature_importance.index.is_unique

    df = pd.DataFrame(
        dict(
            feature=adj_feature_importance.index,
            dim_type=adj_feature_importance["dim_type"].values.tolist(),
            adj_feature_importance=adj_feature_importance[0].values.tolist(),
        )
    ).head(10)

    # TODO: take this out. This is a short cut for the prototype.
    feature_types_by_model = get_feature_type_labels_added_by_model_step()

    def get_feature_set(feature_type: str):
        for key, val in feature_types_by_model.items():
            if feature_type in val:
                return key

    df["feature_type"] = [x for x in df["dim_type"]]
    df["feature_set"] = [get_feature_set(x) for x in df["feature_type"]]
    df["feature"] = [x.replace("_", " ") for x in df["feature"]]

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

    # TODO: This is temporary until we have a real mapping
    GENE_PATTERN = re.compile("\S+ \((\d+)\)")
    unique_gene_symbols = set()
    for feature_name in df["feature"].values:
        m = GENE_PATTERN.match(feature_name)
        if m is not None:
            symbol = m.group(0).split(" ")[0]
            unique_gene_symbols.add(symbol)

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

    gene_predictions = get_dataset_column_by_gene(dataset.id, gene_symbol)
    gene_actuals = get_column_by_gene(actuals, gene_symbol)

    model_ids = gene_actuals.index.tolist()
    prediction_model_ids = gene_predictions.index.tolist()
    # Finding this intersection is temporary due to the sample predictability
    # data using 23q4 data, but working with a copy of the 24q2 database.
    allowed_model_ids = list(set(model_ids) & set(prediction_model_ids))

    gene_predictions = gene_predictions.loc[allowed_model_ids]
    gene_actuals = gene_actuals.loc[allowed_model_ids]

    data = pd.DataFrame(dict(predictions=gene_predictions, actuals=gene_actuals))
    density = get_density(gene_predictions, gene_actuals)

    return {
        "model_pred_data": data.to_dict("list"),
        "x_label": "actuals",
        "y_label": "predictions",
        "density": list(density),
        "model": model,
    }


def get_dataset_id_from_taiga_id(
    model: str, screen_type: str, feature_name: str, feature_type: str
):

    (
        taiga_id,
        feature_given_id,
    ) = PrototypePredictiveFeature.get_taiga_id_from_full_feature_name(
        model, feature_name, screen_type
    )

    matrix_datasets = data_access.get_all_matrix_datasets()
    feature_dataset_id = None

    for dataset in matrix_datasets:
        if dataset.taiga_id == taiga_id:
            feature_dataset_id = dataset.id
            break

    assert feature_dataset_id is not None, f"{taiga_id}, {feature_name}"

    return feature_dataset_id


def get_feature_slice_by_type(feature_type: str, feature_name: str):
    dataset_id = get_dataset_id_from_feature_type(feature_type)
    slice = data_access.get_row_of_values(dataset_id, feature_name)

    return slice


def get_feature_slice_and_dataset_id(
    screen_type: str,
    feature_name: str,
    feature_given_id: str,
    feature_type: str,
    model: str,
    feature_label: str,
):

    feature_dataset_id = get_dataset_id_from_taiga_id(
        model=model,
        screen_type=screen_type,
        feature_name=feature_name,
        feature_type=feature_type,
    )

    slice = data_access.get_row_of_values(
        feature_dataset_id,
        feature_given_id if isinstance(feature_given_id, str) else feature_label,
    )

    return slice.dropna(), feature_dataset_id


# Index(['feature_label', 'given_id', 'importance', 'rank', 'pearson', 'entity'], dtype='object')
def get_top_features(gene_symbol: str, model: str, screen_type: str):
    feature_df = PrototypePredictiveModel.get_entity_row(
        model_name=model, entity_label=gene_symbol, screen_type=screen_type
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
        slice = None
        exception_datasets = []
        try:
            slice, feature_dataset_id = get_feature_slice_and_dataset_id(
                screen_type=screen_type,
                feature_name=feature_name,
                feature_given_id=feature_given_id,
                feature_type=feature_type,
                model=model,
                feature_label=feature_label,
            )
        except:
            # breakpoint()
            # print(feature_info)
            # print(feature_name)
            # test = data_access.get_dataset_feature_labels(
            #     "breadbox/3c279aef-2430-4ad0-a812-661f98686161"
            # )
            # print(test)
            exception_datasets.append(feature_info)
            continue

        feature_importance = feature_info["importance"]
        pearson = feature_info["pearson"]

        slice = slice.dropna()
        top_features[feature_name] = slice

        top_features_metadata[feature_name] = {
            "feature_name": feature_name,
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


def get_feature_gene_effect_plot_data(
    model: str,
    gene_symbol: str,
    feature_index: int,
    feature_name: str,
    feature_type: str,
    screen_type: str,
):
    row = PrototypePredictiveModel.get_entity_row(
        model_name=model, entity_label=gene_symbol, screen_type=screen_type
    )

    gene_series = get_dataset_column_by_gene("Chronos_Combined", gene_symbol)

    feature = row.iloc[[feature_index]]

    feature_name = feature["feature_name"].values[0]
    feature_type = feature["dim_type"].values[0]
    given_id = feature["given_id"].values[0]
    feature_label = feature["feature_label"].values[0]

    # TODO: Remove hackery inside get_feature_slice that does different logic for getting the
    # feature_dataset_id depending on the model name. This should be removeable once we
    # have real data. At that point, get the feature_dataset_id FIRST and use as param to get_feature_slice
    slice, feature_dataset_id = get_feature_slice_and_dataset_id(
        screen_type=screen_type,
        feature_name=feature_name,
        feature_given_id=given_id,
        feature_type=feature_type,
        feature_label=feature_label,
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
        density = get_density(feature_values, gene_slice)

    feature_dataset_units = data_access.get_dataset_units(feature_dataset_id)

    return {
        "actuals_slice": gene_slice,
        "feature_dataset_id": feature_dataset_id,
        "feature_actuals_values": slice.values.tolist(),
        "feature_actuals_value_labels": slice.index.tolist(),
        "density": list(density),
        "x_axis_label": f"{feature_name} {feature_dataset_units}",
        "y_axis_label": f"{gene_symbol} Gene Effect",
    }


def get_feature_boxplot_data(
    screen_type: str, feature_name_type: str, entity_label: str, model: str,
):
    feature = PrototypePredictiveFeatureResult.get_feature_result(
        model_name=model,
        entity_label=entity_label,
        screen_type=screen_type,
        feature_name=feature_name_type,
    )

    feature_name = feature["feature_name"].values[0]
    feature_type = feature["dim_type"].values[0]
    given_id = feature["given_id"].values[0]
    feature_label = feature["feature_label"].values[0]

    slice, _ = get_feature_slice_and_dataset_id(
        screen_type=screen_type,
        feature_name=feature_name,
        feature_given_id=given_id,
        feature_type=feature_type,
        feature_label=feature_label,
        model=model,
    )

    return slice.dropna().values.tolist()


def feature_correlation_map_calc(model, gene_symbol, screen_type: str):
    top_features_and_metadata = get_top_features(
        screen_type=screen_type, gene_symbol=gene_symbol, model=model
    )
    top_features = top_features_and_metadata["top_features"]
    top_features_metadata = top_features_and_metadata["metadata"]
    df = pd.DataFrame(top_features)
    metadata_df = pd.DataFrame(top_features_metadata)

    df = df.corr()

    row_labels = df.index.tolist()
    values = df.replace(np.nan, None).values.tolist()

    # TODO: This is temporary until we have a real mapping
    GENE_PATTERN = re.compile("\S+ \((\d+)\)")
    gene_symbol_feature_types = {}
    for feature_name in list(top_features.keys()):
        m = GENE_PATTERN.match(feature_name)
        if m is not None:
            symbol = m.group(0).split(" ")[0]
            if symbol not in gene_symbol_feature_types:
                feature_type = feature_name.split("_")[-1]
                gene_symbol_feature_types[symbol] = feature_type

    feature_names = []
    feature_types = []
    for feature in row_labels:
        feature_name = "_".join(feature.split("_")[:-1])
        feature_type = feature.split("_")[-1]
        feature_names.append(feature_name)
        feature_types.append(feature_type)

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


def get_other_feature_corrs(feature_df, feature_slice):
    return feature_df.corrwith(feature_slice, axis=1)


def get_ge_corrs(gene, feature_df):
    ge_slice = data_access.get_row_of_values("Chronos_Combined", gene)
    ge_slice = ge_slice.dropna()

    return feature_df.corrwith(ge_slice, axis=1)


def get_related_features_scatter(
    gene_symbol,
    feature,
    feature_type,
    feature_slice_values,
    feature_slice_index,
    feature_dataset_id,
):
    feature_df = data_access.get_subsetted_df_by_labels(
        feature_dataset_id, None, feature_slice_index
    )
    feature_df = feature_df.dropna()

    x = get_other_feature_corrs(
        feature_df=feature_df,
        feature_slice=pd.Series(index=feature_slice_index, data=feature_slice_values,),
    )

    y = get_ge_corrs(gene=gene_symbol, feature_df=feature_df)
    density = get_density(x.fillna(0), y.fillna(0))

    x_label = "Other %s R with %s" % (feature_type, feature)
    y_label = "Other %s R with %s Gene Effect" % (feature_type, gene_symbol)

    return {
        "x": x.dropna().to_list(),
        "y": y.dropna().to_list(),
        "density": list(density),
        "x_label": x_label,
        "y_label": y_label,
    }


def get_other_dep_waterfall_plot(
    feature, feature_type, feature_slice_values, feature_slice_index
):
    gene_df = data_access.get_subsetted_df_by_labels(
        "Chronos_Combined", None, feature_slice_index
    )
    gene_df = gene_df.dropna()
    x = gene_df.corrwith(
        pd.Series(data=feature_slice_values, index=feature_slice_index), axis=1
    )

    # TODO confirm this method returns proper results. Example used corrwith but that
    # was 2x as slow as just using apply with np.corrcoef.
    # x = gene_df.apply(
    #     (lambda x: np.corrcoef(x.values, feature_slice_values, dtype=np.float64)[0, 1]),
    #     axis=1,
    # )
    x.dropna()

    x = list(x)
    x.sort()
    y = list(range(len(x)))
    y_label = "Gene Effect R with %s %s" % (feature, feature_type)

    return {"x": x, "y": y, "x_label": "Rank", "y_label": y_label}


def get_feature_corr_plot(model, gene_symbol, feature_name_type, screen_type: str):
    top_features = get_top_features(
        screen_type=screen_type, gene_symbol=gene_symbol, model=model
    )
    full_feature_info = top_features["metadata"][feature_name_type]

    feature_dataset_id = full_feature_info["feature_dataset_id"]

    rel_features_scatter_plot = None
    if data_access.is_continuous(feature_dataset_id):
        rel_features_scatter_plot = get_related_features_scatter(
            gene_symbol=gene_symbol,
            feature=full_feature_info["feature_name"],
            feature_type=full_feature_info["feature_type"],
            feature_slice_values=full_feature_info["feature_actuals_values"],
            feature_slice_index=full_feature_info["feature_actuals_value_labels"],
            feature_dataset_id=full_feature_info["feature_dataset_id"],
        )

    return rel_features_scatter_plot


def get_feature_waterfall_plot(model, gene_symbol, feature_name_type, screen_type: str):
    top_features = get_top_features(
        screen_type=screen_type, gene_symbol=gene_symbol, model=model
    )
    full_feature_info = top_features["metadata"][feature_name_type]

    feature_dataset_id = full_feature_info["feature_dataset_id"]

    waterfall_plot = None
    if data_access.is_continuous(feature_dataset_id):
        waterfall_plot = get_other_dep_waterfall_plot(
            feature=full_feature_info["feature_name"],
            feature_type=full_feature_info["feature_type"],
            feature_slice_values=full_feature_info["feature_actuals_values"],
            feature_slice_index=full_feature_info["feature_actuals_value_labels"],
        )

    return waterfall_plot
