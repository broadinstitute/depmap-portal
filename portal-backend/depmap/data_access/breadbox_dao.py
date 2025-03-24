import pandas as pd
from typing import Optional, Union, cast

from breadbox_client.models import (
    DimensionType,
    MatrixDatasetResponse,
    MatrixDatasetResponseFormat,
    TabularDatasetResponse,
)
from breadbox_client.types import Unset
from depmap.data_access.response_parsing import (
    is_breadbox_id_format,
    parse_breadbox_slice_id,
    parse_matrix_dataset_response,
    remove_breadbox_prefix,
)
from depmap.data_access.models import MatrixDataset
from depmap import extensions
from depmap.partials.matrix.models import CellLineSeries
from depmap.interactive.config.models import DatasetSortKey, DatasetSortFirstKey
import flask


def _get_breadbox_datasets_with_caching() -> list[
    Union[MatrixDatasetResponse, TabularDatasetResponse]
]:
    """
    Cache the results of breadbox's get_datasets function (scoped to the flask request) because
    some operations (ie: predictability) result in a _lot_ of calls in order
    to answer the question is an ID in breadbox or not in the course of handling the request.
    """
    if hasattr(flask.g, "__cached_get_datasets"):
        return cast(
            list[Union[MatrixDatasetResponse, TabularDatasetResponse]],
            flask.g.__cached_get_datasets,
        )
    else:
        flask.g.__cached_get_datasets = extensions.breadbox.client.get_datasets()
        return flask.g.__cached_get_datasets


def get_all_matrix_datasets() -> list[MatrixDataset]:
    """
    Return all breadbox matrix datasets.
    """
    matrix_datasets = []
    for dataset in _get_breadbox_datasets_with_caching():
        if dataset.format_ == MatrixDatasetResponseFormat.MATRIX_DATASET:
            assert isinstance(dataset, MatrixDatasetResponse)
            parsed_dataset = parse_matrix_dataset_response(dataset)
            matrix_datasets.append(parsed_dataset)
    return matrix_datasets


def get_filtered_matrix_datasets(
        feature_id: Optional[str] = None,
        feature_type: Optional[str] = None,
        sample_id: Optional[str] = None,
        sample_type: Optional[str] = None,
        value_type: Optional[str] = None,
) -> list[MatrixDataset]:
    """Load a filtered set of datasets (no caching used). Filtering is done on the breadbox side."""
    datasets = extensions.breadbox.client.get_datasets(
        feature_id=feature_id,
        feature_type=feature_type,
        sample_id=sample_id,
        sample_type=sample_type,
        value_type=value_type,
    )
    matrix_datasets = []
    for dataset in datasets:
        if dataset.format_ == MatrixDatasetResponseFormat.MATRIX_DATASET:
            assert isinstance(dataset, MatrixDatasetResponse)
            parsed_dataset = parse_matrix_dataset_response(dataset)
            matrix_datasets.append(parsed_dataset)
    return matrix_datasets




def get_breadbox_given_ids() -> set[str]:
    given_ids = set()
    for dataset in _get_breadbox_datasets_with_caching():
        if dataset.given_id is not None:
            given_ids.add(dataset.given_id)
    return given_ids


def is_breadbox_id(dataset_id: str) -> bool:
    """
    Check if the ID matches either:
    - the breadbox dataset format (prefixed by "breadbox/")
    - or matches the given id of a breadbox dataset
    """
    return is_breadbox_id_format(dataset_id) or dataset_id in get_breadbox_given_ids()


# Eventually we will also need a more generic "get_dataset" that can handle tabular datasets
def get_matrix_dataset(dataset_id: str) -> MatrixDataset:
    bb_dataset_id = remove_breadbox_prefix(dataset_id)
    dataset = extensions.breadbox.client.get_dataset(bb_dataset_id)
    assert isinstance(
        dataset, MatrixDatasetResponse
    ), f"Expected {dataset_id} to be a matrix dataset"
    return parse_matrix_dataset_response(dataset)


def get_dataset_data_type(dataset_id: str) -> Optional[str]:
    return get_matrix_dataset(dataset_id).data_type


def get_dataset_feature_type(dataset_id: str) -> Optional[str]:
    return get_matrix_dataset(dataset_id).feature_type


def get_dataset_sample_type(dataset_id: str) -> Optional[str]:
    return get_matrix_dataset(dataset_id).sample_type


def get_dataset_feature_labels_by_id(dataset_id) -> dict[str, str]:
    bb_dataset_id = remove_breadbox_prefix(dataset_id)
    features = extensions.breadbox.client.get_dataset_features(bb_dataset_id)
    return {feature["id"]: feature["label"] for feature in features}


def get_dataset_sample_labels_by_id(dataset_id) -> dict[str, str]:
    bb_dataset_id = remove_breadbox_prefix(dataset_id)
    samples = extensions.breadbox.client.get_dataset_samples(bb_dataset_id)
    return {sample["id"]: sample["label"] for sample in samples}


def get_dataset_feature_labels(dataset_id: str) -> list[str]:
    bb_dataset_id = remove_breadbox_prefix(dataset_id)
    features = extensions.breadbox.client.get_dataset_features(bb_dataset_id)
    return [feature["label"] for feature in features]


def get_dataset_label(dataset_id: str):
    return get_matrix_dataset(dataset_id).label


def get_dataset_priority(dataset_id: str) -> Optional[int]:
    return get_matrix_dataset(dataset_id).priority


def get_dataset_feature_ids(dataset_id: str) -> list[str]:
    bb_dataset_id = remove_breadbox_prefix(dataset_id)
    features = extensions.breadbox.client.get_dataset_features(bb_dataset_id)
    return [feature["id"] for feature in features]


def get_dataset_sample_ids(dataset_id: str) -> list[str]:
    bb_dataset_id = remove_breadbox_prefix(dataset_id)
    samples = extensions.breadbox.client.get_dataset_samples(bb_dataset_id)
    return [sample["id"] for sample in samples]


def get_dataset_taiga_id(dataset_id: str) -> Optional[str]:
    return get_matrix_dataset(dataset_id).taiga_id


def get_dataset_units(dataset_id: str) -> Optional[str]:
    return get_matrix_dataset(dataset_id).units


def get_row_of_values(dataset_id: str, feature: str) -> CellLineSeries:
    """
    For the given dataset id and a feature label, 
    Get a row of numeric or string values, indexed by depmap_id
    """
    bb_dataset_id = remove_breadbox_prefix(dataset_id)
    single_col_df = extensions.breadbox.client.get_dataset_data(
        dataset_id=bb_dataset_id,
        features=[feature],
        feature_identifier="label",
        samples=None,
        sample_identifier=None,
    )
    return CellLineSeries(single_col_df[feature])


def get_subsetted_df_by_labels(
    dataset_id: str,
    feature_row_labels: Optional[list[str]],
    sample_col_ids: Optional[list[str]],
) -> pd.DataFrame:
    bb_dataset_id = remove_breadbox_prefix(dataset_id)
    return extensions.breadbox.client.get_dataset_data(
        dataset_id=bb_dataset_id,
        features=feature_row_labels,
        feature_identifier="label",
        samples=sample_col_ids,
        sample_identifier="id",
    ).transpose()


def is_categorical(dataset_id: str) -> bool:
    dataset = get_matrix_dataset(dataset_id)
    return not dataset.is_continuous


def is_continuous(dataset_id: str) -> bool:
    return get_matrix_dataset(dataset_id).is_continuous


def valid_row(dataset_id: str, row_name: str) -> bool:
    valid_features = extensions.breadbox.client.get_dataset_features(dataset_id)
    valid_feature_labels = [feature["label"] for feature in valid_features]
    return row_name in valid_feature_labels


def get_tabular_dataset_column(dataset_id: str, column_name: str) -> pd.Series:
    df = extensions.breadbox.client.get_tabular_dataset_data(
        dataset_id=dataset_id,
        columns=[column_name],
        identifier=None,
        indices=None,
        strict=True,
    )
    return df.squeeze()


def get_metadata_dataset_id(dimension_type_name: str) -> Union[str, None]:
    if not hasattr(flask.g, "__cached_dimension_types"):
        flask.g.__cached_dimension_types = (
            extensions.breadbox.client.get_dimension_types()
        )

    dimension_types = cast(list[DimensionType], flask.g.__cached_get_datasets,)

    dataset_id = next(
        (
            dt.metadata_dataset_id
            for dt in dimension_types
            if dt.name == dimension_type_name
        ),
        None,
    )

    return None if dataset_id is Unset else cast(Union[str, None], dataset_id)
