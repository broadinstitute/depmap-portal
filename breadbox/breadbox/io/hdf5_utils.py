from typing import List, Optional, Literal

import h5py
import numpy as np
import pandas as pd
from pandas.core.algorithms import isin

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


def write_hdf5_file(path: str, df: pd.DataFrame, dtype: Literal["float", "str"]):
    f = h5py.File(path, mode="w")
    try:
        # Get the row,col positions where df values are not null
        rows_idx, cols_idx = np.where(df.notnull())
        total_nulls = df.size - len(rows_idx)
        # Determine whether matrix is considered sparse (~2/3 elements are null). Use chunked storage for sparse matrices for more optimal storage
        if total_nulls / df.size > 0.6:
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
            for row_idx, col_idx in zip(rows_idx, cols_idx):
                dataset[row_idx, col_idx] = df.iloc[row_idx, col_idx]
        else:
            if dtype == "str":
                # NOTE: hdf5 will fail to stringify None or <NA>. Use empty string to represent NAs instead
                df = df.fillna("")

            # NOTE: For a large and dense string matrix, the size of the hdf5 will be very large. Right now, list of string matrices are a very rare use case and it is unlikely we'll encounter one that is not sparse. However, if that changes, we should consider other hdf5 size optimization methods such as compression
            f.create_dataset(
                "data",
                shape=df.shape,
                dtype=h5py.string_dtype() if dtype == "str" else np.float64,
                data=df.values,
            )

        create_index_dataset(f, "features", df.columns)
        create_index_dataset(f, "samples", df.index)
    finally:
        f.close()


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
