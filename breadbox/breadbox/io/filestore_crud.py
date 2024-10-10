import os
import shutil
from typing import Any, List, Optional, Union

import pandas as pd

from ..models.dataset import Dataset, ValueType
from .hdf5_utils import write_hdf5_file, read_hdf5_file

DATA_FILE: str = "data.hdf5"


def save_dataset_file(
    dataset_id: str, data_df: pd.DataFrame, filestore_location: str,
):
    base_path = os.path.join(filestore_location, dataset_id)
    os.makedirs(base_path)

    write_hdf5_file(
        get_file_location(dataset_id, filestore_location, DATA_FILE), data_df
    )


def get_file_location(
    dataset: Union[Dataset, str], filestore_location: str, file_name: str = DATA_FILE,
):
    if isinstance(dataset, str):
        return os.path.join(filestore_location, dataset, file_name)
    return os.path.join(filestore_location, dataset.id, file_name)


def get_slice(
    dataset: Dataset,
    feature_indexes: Optional[List[int]],
    sample_indexes: Optional[List[int]],
    filestore_location: str,
    keep_nans: Optional[bool] = False,
):
    df = read_hdf5_file(
        get_file_location(dataset, filestore_location),
        feature_indexes=feature_indexes,
        sample_indexes=sample_indexes,
        keep_nans=keep_nans,
    )

    df = get_df_by_value_type(df, dataset.value_type, dataset.allowed_values)

    return df


def get_feature_slice(
    dataset: Dataset, feature_indexes: List[int], filestore_location: str
) -> pd.DataFrame:
    if len(feature_indexes) == 0:
        raise ValueError(f"No features match query")

    df = read_hdf5_file(
        get_file_location(dataset, filestore_location), feature_indexes=feature_indexes,
    )
    df = get_df_by_value_type(df, dataset.value_type, dataset.allowed_values)

    return df


def get_sample_slice(
    dataset: Dataset, sample_indexes: List[int], filestore_location: str
) -> pd.DataFrame:
    if len(sample_indexes) == 0:
        raise ValueError(f"No samples match query")

    df = read_hdf5_file(
        get_file_location(dataset, filestore_location), sample_indexes=sample_indexes,
    )
    df = get_df_by_value_type(df, dataset.value_type, dataset.allowed_values)
    return df


def get_df_by_value_type(
    df: pd.DataFrame,
    value_type: Optional[ValueType],
    dataset_allowed_values: Optional[Any],
):
    if value_type == ValueType.categorical:
        assert dataset_allowed_values
        dataset_allowed_values.append(None)
        # Convert numerical values back to origincal categorical value
        df = df.astype(int)
        df = df.applymap(lambda x: dataset_allowed_values[x])
    return df


def delete_data_files(dataset_id: str, filestore_location: str):
    base_path = os.path.join(filestore_location, dataset_id)
    assert os.path.isdir(base_path)
    shutil.rmtree(base_path)
