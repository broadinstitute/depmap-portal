from typing import List, Optional

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


def write_hdf5_file(path: str, df: pd.DataFrame):
    f = h5py.File(path, mode="w")
    try:
        f.create_dataset("data", shape=df.shape, dtype=np.float64, data=df.values)

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
