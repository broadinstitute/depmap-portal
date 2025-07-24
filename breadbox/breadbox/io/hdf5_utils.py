from typing import List, Optional, Literal

from breadbox.schemas.dataframe_wrapper import ParquetDataFrameWrapper
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
    batch_size: int = 10000,  # Adjust batch size as needed
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
                for row_idx, col_idx in df_wrapper.nonnull_indices:
                    dataset[row_idx, col_idx] = df.iloc[row_idx, col_idx]
            else:
                # NOTE: For a large and dense string matrix, the size of the hdf5 will be very large. Right now, list of string matrices are a very rare use case and it is unlikely we'll encounter one that is not sparse. However, if that changes, we should consider other hdf5 size optimization methods such as compression
                dataset = f.create_dataset(
                    "data",
                    shape=df.shape,
                    dtype=h5py.string_dtype() if dtype == "str" else np.float64,
                    data=df.values,
                )
        else:
            assert isinstance(df_wrapper, ParquetDataFrameWrapper)
            # For ParquetDataFrameWrapper
            # TODO: This can probably be used for PandasDataFrameWrapper as well
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

            parquet_file = ParquetFile(df_wrapper.parquet_path)

            for i in range(0, len(cols), batch_size):
                print(f"Processing batch {i+1}...")
                col_batch = cols[i : i + batch_size]
                chunk_df = pd.read_parquet(
                    df_wrapper.parquet_path, columns=col_batch, engine="pyarrow"
                )

                if i == 0:
                    print("got df!")
                    print(chunk_df.shape)

                if dtype == "str":
                    # NOTE: hdf5 will fail to stringify None or <NA>. Use empty string to represent NAs instead
                    chunk_df = chunk_df.fillna("")
                # Find the correct column slice to write
                end_col = i + batch_size
                dataset[:, i:end_col] = chunk_df.values

        create_index_dataset(f, "features", pd.Index(df_wrapper.get_column_names()))
        create_index_dataset(f, "samples", pd.Index(df_wrapper.get_index_names()))
    finally:
        f.close()


# def batched_columns(column_names: List[str], batch_size: int = 5000):
#     """
#     Returns a generator that yields batches of column names to avoid memory issues with large datasets (e.g. >200k columns).
#     """
#     for i in range(0, len(column_names), batch_size):
#         yield column_names[i : i + batch_size]


def read_hdf5_file(
    path: str,
    feature_indexes: Optional[List[int]] = None,
    sample_indexes: Optional[List[int]] = None,
    keep_nans: Optional[bool] = False,
):
    """Return subsetted df based on provided feature and sample indexes. If either feature or sample indexes is None then return all features or samples"""
    with h5py.File(path, mode="r") as f:
        if feature_indexes is not None and sample_indexes is not None:
            # Not an optimized way of subsetting data but probably fine
            data = f["data"][sample_indexes, :][:, feature_indexes]
            feature_ids = f["features"][feature_indexes]
            sample_ids = f["samples"][sample_indexes]
        elif feature_indexes is not None:
            data = f["data"][:, feature_indexes]
            feature_ids = f["features"][feature_indexes]
            sample_ids = f["samples"]
        elif sample_indexes is not None:
            data = f["data"][sample_indexes]
            feature_ids = f["features"]
            sample_ids = f["samples"][sample_indexes]
        else:
            data = f["data"]
            feature_ids = f["features"]
            sample_ids = f["samples"]

        feature_ids = [x.decode("utf8") for x in feature_ids]
        sample_ids = [x.decode("utf8") for x in sample_ids]

        df = pd.DataFrame(data=data, columns=feature_ids, index=sample_ids)

        # Must convert NaNs to None bc NaNs not json serializable
        if not keep_nans:
            df = df.replace({np.nan: None})
    return df
