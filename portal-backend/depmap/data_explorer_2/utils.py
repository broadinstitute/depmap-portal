import re
from typing import Any
import functools
import numpy as np
import pandas as pd
from logging import getLogger

from depmap_compute.slice import decode_slice_id
from depmap import data_access
from depmap.data_access.models import MatrixDataset
from depmap.data_explorer_2.datatypes import blocked_dimension_types


log = getLogger(__name__)


@functools.cache
def get_vector_labels(dataset_id: str, is_transpose: bool) -> list[str]:
    """
    DEPRECATED: this does not use the definition of "labels" that we are using
    going forward. For samples, this returns IDs as labels. 
    Load all labels for an axis of the given dataset.
    If is_transpose, then get depmap_ids/sample labels.
    Otherwise, get sample/feature labels.
    """
    if dataset_id == "Context_Matrix":
        dataset_id = "subtype_matrix"

    if is_transpose:
        return data_access.get_dataset_sample_ids(dataset_id)

    return data_access.get_dataset_feature_labels(dataset_id)


def get_dimension_labels_of_dataset(dimension_type: str, dataset: MatrixDataset):
    """
    DEPRECATED: this does not use the definition of "labels" that we are using
    going forward. For samples, this returns IDs as labels. 
    """
    if dimension_type not in (dataset.feature_type, dataset.sample_type):
        return set()

    is_transpose = dimension_type == dataset.sample_type

    labels = get_vector_labels(dataset.id, is_transpose)
    return set(labels)


# There are also several bespoke slice IDs here that don't correlate with real
# datasets. For example, there is no "gene_essentiality" dataset. Those data
# are drawn from the gene_exective_info table in the sqlite db.
def get_series_from_de2_slice_id(slice_id: str) -> pd.Series:
    """
    Data Explorer 2 slice ids are a superset of legacy slice ids.
    One difference is that DE2 slice ids can include "transpose_label"
    as a feature type, which indicates that the result should be transposed.
    "transpose_label" is used similarly to the "depmap_model" feature type in slice ids.
    """
    dataset_id, feature_label, feature_type = decode_slice_id(slice_id)

    # Handle special cases
    if slice_id == "slice/compound_experiment/compound_name/label":
        return get_compound_experiment_compound_name_series()
    if slice_id == "slice/compound_experiment/compound_instance/label":
        return get_compound_experiment_compound_instance_series()
    if slice_id.startswith("slice/mutations_prioritized/"):
        return get_mutations_prioritized_series(dataset_id, feature_label)
    if slice_id.startswith("slice/Context_Matrix/"):
        return get_series_from_de2_slice_id(
            slice_id.replace("/Context_Matrix/", "/subtype_matrix/")
        )
    # HACK: These aren't real dataset IDs, just magic strings
    if dataset_id in ("depmap_model_metadata", "screen_metadata"):
        dimension_type_name = (
            "depmap_model"
            if dataset_id == "depmap_model_metadata"
            else "Screen metadata"
        )
        metadata_dataset_id = data_access.get_metadata_dataset_id(dimension_type_name)

        if metadata_dataset_id is None:
            raise LookupError(
                f"Could not find metadata_dataset_id for dimension type '{dimension_type_name}'!"
            )

        return data_access.breadbox_dao.get_tabular_dataset_column(  # pyright: ignore
            metadata_dataset_id, feature_label
        )

    is_transpose = feature_type == "transpose_label"
    if is_transpose and data_access.is_continuous(dataset_id):
        # For transposed slice ids we need to load a single-column dataframe
        # even though the implementation of this can't handle categorical data
        single_col_df = data_access.get_subsetted_df_by_labels(
            dataset_id=dataset_id,
            feature_row_labels=None,
            sample_col_ids=[feature_label],
        )
        return single_col_df[feature_label]
    if not is_transpose:
        # This is currently the only way to load categorical data from the
        # legacy backend
        return data_access.get_row_of_values(dataset_id, feature_label)

    raise NotImplementedError(
        f"Unable to load a transposed non-continuous dataset (slice_id: {slice_id})"
    )


def slice_to_dict(slice_id: str) -> dict[str, Any]:
    """For the given slice ID, load a dictionary of values keyed by label."""
    return get_series_from_de2_slice_id(slice_id).replace({np.nan: None}).to_dict()


def get_compound_experiment_compound_name_series():
    dictionary = {}
    labels = get_dimension_labels_across_datasets("compound_experiment")

    for label in labels:
        compound_name = re.search(r"(.*) ((?<!-)\(.*)", label).groups()[0]
        dictionary[label] = compound_name

    return pd.Series(dictionary)


def get_compound_experiment_compound_instance_series():
    dictionary = {}
    labels = get_dimension_labels_across_datasets("compound_experiment")

    for label in labels:
        compound_instance = re.search(r"(.*) ((?<!-)\(.*)", label).groups()[1]
        dictionary[label] = compound_instance

    return pd.Series(dictionary)


def get_mutations_prioritized_series(dataset_id: str, feature: str):
    series = data_access.get_row_of_values(dataset_id=dataset_id, feature=feature)

    for feature_label, value in series.items():
        # We throw out "Other" values because Data Explorer 2 labels NA values
        # as "Other", sometimes leading to two different types of "Other" being
        # displayed at once. As far as I can tell, these should actually be
        # considered NAs (i.e. points for which we have no data) and not "other
        # unspecified mutations."
        if value == "Other":
            series[feature_label] = None

    return series


def get_dimension_labels_across_datasets(dimension_type):
    all_labels = set()

    for dataset in get_all_supported_continuous_datasets():
        labels = get_dimension_labels_of_dataset(dimension_type, dataset)
        all_labels = all_labels.union(labels)

    return sorted(list(all_labels))



def get_datasets_from_dimension_type(dimension_type: str) -> list[MatrixDataset]:
    datasets = []

    for dataset in get_all_supported_continuous_datasets():
        if dimension_type == dataset.feature_type:
            datasets.append(dataset)
        elif dimension_type == dataset.sample_type:
            datasets.append(dataset)

    return datasets


def get_all_supported_continuous_datasets() -> list[MatrixDataset]:
    out = []

    for dataset in data_access.get_all_matrix_datasets():

        if not dataset.is_continuous:
            continue
        if dataset.feature_type is None:
            continue
        if dataset.feature_type in blocked_dimension_types:
            continue
        if dataset.sample_type in blocked_dimension_types:
            continue
        if dataset.data_type == "metadata":
            continue

        if dataset.data_type is None:
            log.warning(
                "Data Explorer 2: No data_type defined for dataset '%s'. ", dataset.id,
            )
        if dataset.units is None:
            log.warning(
                "Data Explorer 2: No units defined for dataset '%s'. ", dataset.id,
            )

        if dataset.data_type is None or dataset.units is None:
            continue

        out.append(dataset)

    return out


def clear_cache():
    get_vector_labels.cache_clear()
