import os
import shutil
import json
from typing import Any, List, Optional, Union, Callable

import pandas as pd

from ..schemas.dataframe_wrapper import DataFrameWrapper
from ..models.dataset import Dataset, MatrixDataset, ValueType
from .hdf5_utils import (
    write_hdf5_file,
    read_hdf5_file,
)
from .hdf5_value_mapping import get_hdf5_to_value_mapping
from breadbox.schemas.custom_http_exception import (
    SampleNotFoundError,
    FeatureNotFoundError,
)

DATA_FILE: str = "data.hdf5"


def save_dataset_file(
    dataset_id: str,
    df_wrapper: DataFrameWrapper,
    value_type: ValueType,
    map_values: Optional[Callable[[pd.DataFrame], pd.DataFrame]],
    filestore_location: str,
):
    base_path = os.path.join(filestore_location, dataset_id)
    os.makedirs(base_path)

    if value_type == ValueType.list_strings:
        dtype = "str"
    else:
        dtype = "float"

    write_hdf5_file(
        get_file_location(dataset_id, filestore_location, DATA_FILE),
        df_wrapper,
        dtype,
        map_values if map_values is not None else lambda x: x,
    )


def get_file_location(
    dataset: Union[Dataset, str], filestore_location: str, file_name: str = DATA_FILE,
):
    if isinstance(dataset, str):
        return os.path.join(filestore_location, dataset, file_name)
    return os.path.join(filestore_location, dataset.id, file_name)


def _identity_if_none(transform: Optional[Callable[[pd.DataFrame], pd.DataFrame]]):
    if transform is None:
        return lambda x: x
    return transform


def get_slice(
    dataset: MatrixDataset,
    feature_indexes: Optional[List[int]],
    sample_indexes: Optional[List[int]],
    filestore_location: str,
    keep_nans: Optional[bool] = False,
    indices_as_index: bool = False,
):
    df = read_hdf5_file(
        get_file_location(dataset, filestore_location),
        feature_indexes=feature_indexes,
        sample_indexes=sample_indexes,
        keep_nans=keep_nans,
        indices_as_index=indices_as_index,
    )

    value_mapping = _identity_if_none(
        get_hdf5_to_value_mapping(dataset.value_type, dataset.allowed_values)
    )

    return value_mapping(df)


def get_feature_slice(
    dataset: MatrixDataset, feature_indexes: List[int], filestore_location: str
) -> pd.DataFrame:
    """
    Load a dataframe of feature data belonging to the given indexes.
    The resulting dataframe will be indexed by given IDs with features as columns.
    """
    if len(feature_indexes) == 0:
        raise FeatureNotFoundError(f"No features match query")

    df = read_hdf5_file(
        get_file_location(dataset, filestore_location), feature_indexes=feature_indexes,
    )

    value_mapping = _identity_if_none(
        get_hdf5_to_value_mapping(dataset.value_type, dataset.allowed_values)
    )

    return value_mapping(df)


def get_sample_slice(
    dataset: MatrixDataset, sample_indexes: List[int], filestore_location: str
) -> pd.DataFrame:
    """
    Load a dataframe of sample data belonging to the given indexes.
    The resulting dataframe will be indexed by given IDs with samples as rows.
    """
    if len(sample_indexes) == 0:
        raise SampleNotFoundError(f"No samples match query")

    df = read_hdf5_file(
        get_file_location(dataset, filestore_location), sample_indexes=sample_indexes,
    )

    value_mapping = _identity_if_none(
        get_hdf5_to_value_mapping(dataset.value_type, dataset.allowed_values)
    )

    return value_mapping(df)


def delete_data_files(dataset_id: str, filestore_location: str):
    base_path = os.path.join(filestore_location, dataset_id)
    assert os.path.isdir(base_path)
    shutil.rmtree(base_path)
