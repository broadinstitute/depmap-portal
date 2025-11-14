from typing import List, Optional, Literal

from breadbox.schemas.custom_http_exception import (
    FileValidationError,
    LargeDatasetReadError,
)
import h5py
import numpy as np
import pandas as pd
from pandas.core.algorithms import isin

from breadbox.io.data_validation import DataFrameWrapper, PandasDataFrameWrapper
import pyarrow as pa
from pyarrow.parquet import ParquetFile

# This is the Object dtype with metadata for HDF5 to parse it as (variable-length)
# string. The metadata is not used for checking equality.
# See https://docs.h5py.org/en/3.2.1/strings.html
STR_DTYPE = h5py.string_dtype()
MAX_HDF5_READ_IN_BYTES = 1024 * 1024 * 1024


def create_index_dataset(f: h5py.File, key: str, idx: pd.Index):
    data = idx

    dtype = STR_DTYPE

    f.create_dataset(
        key, shape=idx.shape, dtype=dtype, data=data,
    )


def write_hdf5_file(
    path: str,
    df_wrapper: DataFrameWrapper,
    dtype: Literal["float", "str"],
    batch_size: int = 5000,  # Adjust batch size as needed
):
    f = h5py.File(path, mode="w")
    try:
        if isinstance(df_wrapper, PandasDataFrameWrapper):
            df = df_wrapper.get_df()
            # Convert to float type so hdf5 can store it as float64
            if dtype == "float":
                df = df.astype(np.float64)
            # If the DataFrame is sparse, we need to store only
            if df_wrapper.is_sparse():
                dataset = f.create_dataset(
                    "data",
                    shape=df.shape,
                    dtype=h5py.string_dtype() if dtype == "str" else np.float64,
                    chunks=(
                        1,
                        1,
                    ),  # Arbitrarily set size since it at least appears to yield smaller storage size than autochunking
                )
                # only insert nonnull values into hdf5 at given positions
                for row_idx, col_idx in df_wrapper.get_nonnull_indices():
                    dataset[row_idx, col_idx] = df.iloc[row_idx, col_idx]
            else:
                if dtype == "str":
                    # NOTE: hdf5 will fail to stringify None or <NA>. Use empty string to represent NAs instead
                    df = df.fillna("")
                # NOTE: For a large and dense string matrix, the size of the hdf5 will be very large. Right now, list of string matrices are a very rare use case and it is unlikely we'll encounter one that is not sparse. However, if that changes, we should consider other hdf5 size optimization methods such as compression
                dataset = f.create_dataset(
                    "data",
                    shape=df.shape,
                    dtype=h5py.string_dtype() if dtype == "str" else np.float64,
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
                dtype=h5py.string_dtype() if dtype == "str" else np.float64,
            )

            for i in range(0, len(cols), batch_size):
                # Find the correct column slice to write
                end_col = i + batch_size

                col_batch = cols[i:end_col]

                # Read the chunk of data from the Parquet file
                chunk_df = df_wrapper.read_columns(col_batch)

                if dtype == "str":
                    # NOTE: hdf5 will fail to stringify None or <NA>. Use empty string to represent NAs instead
                    chunk_df = chunk_df.fillna("")
                else:
                    chunk_df = chunk_df.astype("float")

                values = chunk_df.values
                try:
                    dataset[:, i:end_col] = values
                except Exception as e:
                    raise FileValidationError(
                        f"Failed to update {i}:{end_col} of hdf5 file {path} with {values}"
                    ) from e

        create_index_dataset(f, "features", pd.Index(df_wrapper.get_column_names()))
        create_index_dataset(f, "samples", pd.Index(df_wrapper.get_index_names()))
    except Exception as e:
        raise FileValidationError("Failed to save dataset to hdf5 file!") from e
    finally:
        f.close()


# def batched_columns(column_names: List[str], batch_size: int = 5000):
#     """
#     Returns a generator that yields batches of column names to avoid memory issues with large datasets (e.g. >200k columns).
#     """
#     for i in range(0, len(column_names), batch_size):
#         yield column_names[i : i + batch_size]


from breadbox.utils.debug_log import print_span_stats


def read_hdf5_file(
    path: str,
    feature_indexes: Optional[List[int]] = None,
    sample_indexes: Optional[List[int]] = None,
    keep_nans: Optional[bool] = False,
):
    """Return subsetted df based on provided feature and sample indexes. If either feature or sample indexes is None then return all features or samples"""
    with h5py.File(path, mode="r") as f:
        with print_span_stats("basic read from hdf5 file"):
            row_len, col_len = f["data"].shape  # type: ignore
            print(
                f"reading {row_len} rows and {col_len} columns (expected size: {row_len * col_len * 8 // 1024 ** 2} MB)"
            )
            if feature_indexes is not None and sample_indexes is not None:
                _validate_read_size(len(feature_indexes), len(sample_indexes))
                # Not an optimized way of subsetting data but probably fine
                data = f["data"][sample_indexes, :][:, feature_indexes]
                feature_ids = f["features"][feature_indexes]
                sample_ids = f["samples"][sample_indexes]
            elif feature_indexes is not None:
                _validate_read_size(len(feature_indexes), row_len)
                data = f["data"][:, feature_indexes]
                feature_ids = f["features"][feature_indexes]
                sample_ids = f["samples"]
            elif sample_indexes is not None:
                _validate_read_size(col_len, len(sample_indexes))
                data = f["data"][sample_indexes]
                feature_ids = f["features"]
                sample_ids = f["samples"][sample_indexes]
            else:
                _validate_read_size(col_len, row_len)
                data = f["data"]
                feature_ids = f["features"]
                sample_ids = f["samples"]

            with print_span_stats("read labels"):
                feature_ids = [x.decode("utf8") for x in feature_ids]
                sample_ids = [x.decode("utf8") for x in sample_ids]

            with print_span_stats("construct dataframe"):
                df = pd.DataFrame(
                    data=data, columns=pd.Index(feature_ids), index=pd.Index(sample_ids)
                )

            with print_span_stats("conversion nonsense"):
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
