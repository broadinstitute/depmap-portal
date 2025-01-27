import pandas as pd
from typing import Optional

from breadbox_client.models import MatrixDatasetResponse, MatrixDatasetResponseFormat
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


def get_all_matrix_datasets(
        feature_id: Optional[str] = None,
        feature_type: Optional[str] = None,
        sample_id: Optional[str] = None,
        sample_type: Optional[str] = None,
        value_type: Optional[str] = None,
) -> list[MatrixDataset]:
    """
    Return all breadbox matrix datasets.
    """
    all_bb_datasets = extensions.breadbox.client.get_datasets(
        feature_id=feature_id,
        feature_type=feature_type,
        sample_id=sample_id,
        sample_type=sample_type,
        value_type=value_type,
    )
    matrix_datasets = []
    for dataset in all_bb_datasets:
        if dataset.format_ == MatrixDatasetResponseFormat.MATRIX_DATASET:
            assert isinstance(dataset, MatrixDatasetResponse)
            parsed_dataset = parse_matrix_dataset_response(dataset)
            matrix_datasets.append(parsed_dataset)
    return matrix_datasets


def get_breadbox_given_ids() -> set[str]:
    given_ids = set()
    for dataset in extensions.breadbox.client.get_datasets():
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


def get_sort_key(dataset_id: str) -> DatasetSortKey:
    """
    Sort breadbox datasets in with private datasets.
    This method is only used in DE1. DE2 uses the 'priority' field instead.
    """
    return DatasetSortKey(
        DatasetSortFirstKey.custom_or_private.value, 0, get_dataset_label(dataset_id),
    )


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
