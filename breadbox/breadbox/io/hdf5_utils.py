import os.path
import tempfile
from typing import List, Optional, Literal, Callable


from breadbox.schemas.custom_http_exception import (
    FileValidationError,
    LargeDatasetReadError,
)
import h5py
import numpy as np
import pandas as pd

from breadbox.io.data_validation import (
    DataFrameWrapper,
    PandasDataFrameWrapper,
    column_batch_iterator,
)

# This is the Object dtype with metadata for HDF5 to parse it as (variable-length)
# string. The metadata is not used for checking equality.
# See https://docs.h5py.org/en/3.2.1/strings.html
STR_DTYPE = h5py.string_dtype()
MAX_HDF5_READ_IN_BYTES = 1024 * 1024 * 1024


def categorical_to_int_encoded_df_or_raise(
    df: pd.DataFrame, allowed_values: List
) -> pd.DataFrame:
    """Given a dataframe of strings, creates a dataframe of integers by looking up the index of each string in allowed_values. If the string isn't in allowed_Values than a FileValidationError is raised"""
    # NOTE: Boolean values turned to string
    lower_allowed_values = [str(x).lower() for x in allowed_values if x is not None] + [
        None
    ]  # Data values can include missing values

    lower_df = df.applymap(lambda x: None if pd.isna(x) else str(x).lower())

    present_values = set(lower_df.values.flatten())
    unexpected_values = present_values.difference(lower_allowed_values)
    if len(unexpected_values) > 0:
        sorted_unexpected_values = sorted(unexpected_values)
        examples = ", ".join([repr(x) for x in sorted_unexpected_values[:10]])
        if len(sorted_unexpected_values) > 10:
            examples += ", ..."
        raise FileValidationError(
            f"Found values (examples: {examples}) not in list of allowed values: {allowed_values}"
        )

    # Convert categories to ints for more efficient storage
    lower_allowed_values_map = {x: i for i, x in enumerate(lower_allowed_values)}
    int_df = lower_df.applymap(lambda x: lower_allowed_values_map[x])

    int_df = int_df.astype(int)

    return int_df


def create_index_dataset(f: h5py.File, key: str, idx: pd.Index):
    data = idx

    dtype = STR_DTYPE

    f.create_dataset(
        key, shape=idx.shape, dtype=dtype, data=data,
    )


def is_sparse_df(df: pd.DataFrame) -> bool:
    total_nulls = df.apply(lambda x: x.isna().sum()).sum()
    # Determine whether matrix is considered sparse (~2/3 elements are null). Use chunked storage for sparse matrices for more optimal storage
    is_sparse = total_nulls / df.size > 0.6
    return is_sparse


def write_hdf5_file(
    path: str,
    df_wrapper: DataFrameWrapper,
    hdf5_dtype: Literal["float", "str"],
    map_values: Callable[[pd.DataFrame], pd.DataFrame],
    batch_size: int = 5000,  # Adjust batch size as needed
):
    f = h5py.File(path, mode="w")
    try:
        if isinstance(df_wrapper, PandasDataFrameWrapper):
            df = df_wrapper.get_df()
            df = map_values(df)
            # Convert to float type so hdf5 can store it as float64
            if hdf5_dtype == "float":
                df = df.astype(np.float64)
            # If the DataFrame is sparse, we need to store only
            if is_sparse_df(df):
                dataset = f.create_dataset(
                    "data",
                    shape=df.shape,
                    dtype=h5py.string_dtype() if hdf5_dtype == "str" else np.float64,
                    chunks=(
                        1,
                        1,
                    ),  # Arbitrarily set size since it at least appears to yield smaller storage size than autochunking
                )
                # only insert nonnull values into hdf5 at given positions
                for row_idx, col_idx in df_wrapper.get_nonnull_indices():
                    dataset[row_idx, col_idx] = df.iloc[row_idx, col_idx]
            else:
                if hdf5_dtype == "str":
                    # NOTE: hdf5 will fail to stringify None or <NA>. Use empty string to represent NAs instead
                    df = df.fillna("")
                # NOTE: For a large and dense string matrix, the size of the hdf5 will be very large. Right now, list of string matrices are a very rare use case and it is unlikely we'll encounter one that is not sparse. However, if that changes, we should consider other hdf5 size optimization methods such as compression
                dataset = f.create_dataset(
                    "data",
                    shape=df.shape,
                    dtype=h5py.string_dtype() if hdf5_dtype == "str" else np.float64,
                    data=df.values,
                )
        else:
            # NOTE: Our number of columns are usually much larger than rows so we batch by columns to avoid memory issues
            # TODO: If hdf5 file size becomes an issue, we can consider using compression or chunking
            cols = df_wrapper.get_column_names()
            rows = df_wrapper.get_index_names()
            shape = (len(rows), len(cols))
            dataset = f.create_dataset(
                "data",
                shape=shape,
                dtype=h5py.string_dtype() if hdf5_dtype == "str" else np.float64,
            )

            for start_col_index, end_col_index, chunk_df in column_batch_iterator(
                df_wrapper, batch_size=batch_size
            ):
                chunk_df = map_values(chunk_df)

                if hdf5_dtype == "str":
                    # NOTE: hdf5 will fail to stringify None or <NA>. Use empty string to represent NAs instead
                    chunk_df = chunk_df.fillna("")
                else:
                    chunk_df = chunk_df.astype("float")

                values = chunk_df.values
                try:
                    dataset[:, start_col_index:end_col_index] = values
                except Exception as e:
                    raise FileValidationError(
                        f"Failed to update {start_col_index}:{end_col_index} of hdf5 file {path} with {values}"
                    ) from e

        create_index_dataset(f, "features", pd.Index(df_wrapper.get_column_names()))
        create_index_dataset(f, "samples", pd.Index(df_wrapper.get_index_names()))
    except Exception as e:
        raise FileValidationError("Failed to save dataset to hdf5 file!") from e
    finally:
        f.close()


DUPLICATE_STORAGE = "duplicate_storage"
CHUNKED_STORAGE = "chunked_storage"

import contextlib


@contextlib.contextmanager
def with_hdf5_cache(
    filename,
    feature_indexes: Optional[List[int]],
    sample_indexes: Optional[List[int]],
    cache_strategy,
):
    if cache_strategy is None:
        reformated_file = filename
    else:
        reformated_file = f"{os.path.dirname(filename)}/temp/{cache_strategy}/{os.path.basename(filename)}.h5"
        if not os.path.exists(reformated_file):
            dest_dir = os.path.dirname(reformated_file)
            os.makedirs(dest_dir, exist_ok=True)

            # read the original and copy data to new file
            tmp = tempfile.NamedTemporaryFile(suffix=".h5", delete=False, dir=dest_dir)
            with h5py.File(filename, "r") as src:
                with h5py.File(tmp.name, "w") as dest:
                    for src_name in ["features", "samples"]:
                        data = pd.Index([x.decode("utf8") for x in src[src_name]])
                        create_index_dataset(dest, src_name, data)

                    f_data = src["data"]
                    if cache_strategy == DUPLICATE_STORAGE:
                        dest.create_dataset(
                            "data_by_col",
                            shape=f_data.shape,
                            dtype=f_data.dtype,
                            data=f_data,
                            chunks=(f_data.shape[0], 1),
                        )

                        dest.create_dataset(
                            "data_by_row",
                            shape=f_data.shape,
                            dtype=f_data.dtype,
                            data=f_data,
                            chunks=(1, f_data.shape[1]),
                        )
                    else:
                        assert cache_strategy == CHUNKED_STORAGE

                        dest.create_dataset(
                            "data_by_chunk",
                            shape=f_data.shape,
                            dtype=f_data.dtype,
                            data=f_data,
                            chunks=True,
                        )

            os.rename(tmp.name, reformated_file)

    with h5py.File(reformated_file, "r") as f:
        if cache_strategy == DUPLICATE_STORAGE:
            if feature_indexes is not None and sample_indexes is not None:
                if len(feature_indexes) < len(sample_indexes):
                    f_data = f["data_by_col"]
                else:
                    f_data = f["data_by_row"]
            elif feature_indexes is not None:
                f_data = f["data_by_col"]
            elif sample_indexes is not None:
                f_data = f["data_by_row"]
            else:
                f_data = f["data_by_row"]
        elif cache_strategy == CHUNKED_STORAGE:
            f_data = f["data_by_chunk"]
        else:
            assert cache_strategy is None
            f_data = f["data"]

        yield f, f_data


def read_hdf5_file(
    path: str,
    feature_indexes: Optional[List[int]] = None,
    sample_indexes: Optional[List[int]] = None,
    keep_nans: Optional[bool] = False,
    cache_strategy: Optional[str] = None,
    read_index_names: bool = True,
    indices_as_index: bool = False,
):
    """Return subsetted df based on provided feature and sample indexes. If either feature or sample indexes is None then return all features or samples"""
    with with_hdf5_cache(path, feature_indexes, sample_indexes, cache_strategy) as (
        f,
        f_data,
    ):
        # HDF5 requires indices used by indexing are sorted
        if feature_indexes is not None:
            feature_indexes = sorted(feature_indexes)

        if sample_indexes is not None:
            sample_indexes = sorted(sample_indexes)

        row_len, col_len = f_data.shape  # type: ignore
        feature_ids = None
        sample_ids = None

        if indices_as_index:
            read_index_names = False

        if feature_indexes is not None and sample_indexes is not None:
            _validate_read_size(len(feature_indexes), len(sample_indexes))
            # subset first by the more selective axis. (HDF5 doesn't allow us to subset both axes in a single request)
            if len(feature_indexes) < len(sample_indexes):
                data = f_data[:, feature_indexes][sample_indexes, :]
            else:
                data = f_data[sample_indexes, :][:, feature_indexes]
            if read_index_names:
                feature_ids = f["features"][feature_indexes]
                sample_ids = f["samples"][sample_indexes]
        elif feature_indexes is not None:
            _validate_read_size(len(feature_indexes), row_len)
            data = f_data[:, feature_indexes]
            if read_index_names:
                feature_ids = f["features"][feature_indexes]
                sample_ids = f["samples"]
        elif sample_indexes is not None:
            _validate_read_size(col_len, len(sample_indexes))
            data = f_data[sample_indexes]
            if read_index_names:
                feature_ids = f["features"]
                sample_ids = f["samples"][sample_indexes]
        else:
            _validate_read_size(col_len, row_len)
            data = f_data
            feature_ids = f["features"]
            sample_ids = f["samples"]

        if indices_as_index:
            feature_idx = pd.Index(feature_indexes)
            sample_idx = pd.Index(sample_indexes)
        else:
            assert feature_ids is not None and sample_ids is not None
            feature_idx = pd.Index([x.decode("utf8") for x in feature_ids])
            sample_idx = pd.Index([x.decode("utf8") for x in sample_ids])

        df = pd.DataFrame(data=data, columns=feature_idx, index=sample_idx)

        # Must convert NaNs to None bc NaNs not json serializable
        if not keep_nans:
            df = df.replace({np.nan: None})

    return df


def _validate_read_size(features_length: int, samples_length: int):
    """
    Raise a 500 error if estimated size of reading columns and rows exceed 1GB indicating possible memory exhaustion. 
    TODO: We will need to handle reading large data
    """
    if features_length * samples_length * 8 > MAX_HDF5_READ_IN_BYTES:
        raise LargeDatasetReadError(features_length, samples_length)
