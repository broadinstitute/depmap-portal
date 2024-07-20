import h5py
import os
import pandas as pd
import numpy as np
from typing import List

from depmap.utilities.exception import MatrixConversionException


def get_row_of_values(source_dir: str, file_path: str, index: int) -> List[float]:
    """
    Currently there are no stable ids for genes/cell lines aliases, so entity_id is a varchar
    Return pandas series of dim 1 (row) of hdf5 file
    """
    with open_hdf5_file(source_dir, file_path) as f:
        values = list(f["data"][index, :])
    return values


def get_col_of_values(source_dir, file_path, index):
    """
    Currently there are no stable ids for cell lines aliases, so cell_line is a string
    Return pandas series of dim 2 (col) of hdf5 file
    """
    with open_hdf5_file(source_dir, file_path) as f:
        values = list(f["data"][:, index])
    return values


def get_df_of_values(
    source_dir, file_path, row_indices, col_indices, is_transpose=False
):
    with open_hdf5_file(source_dir, file_path) as f:
        df = pd.DataFrame(
            f["data"][:]
        )  # hdf5 can only index by one array at a time, so we get all then subset in memory
        if is_transpose:
            df = df.transpose()
        if row_indices is None:
            row_indices = np.arange(df.shape[0])
        if col_indices is None:
            col_indices = np.arange(df.shape[1])
        df = df.iloc[row_indices][
            col_indices
        ]  # if keyerror, check that transpose is correct
    return df


def get_row_means(source_dir, file_path):
    with open_hdf5_file(source_dir, file_path) as f:
        df = pd.DataFrame(f["data"][:])
        means = df.mean(axis=1)
    return means


def get_row_index(source_dir, file_path, is_transpose=False):
    if is_transpose:
        return get_col_index(source_dir, file_path)

    with open_hdf5_file(source_dir, file_path) as f:
        dim_0 = [x.decode("utf-8") for x in list(f["dim_0"])]
        assert f["data"].shape[0] == len(dim_0)
        return dim_0


def get_col_index(source_dir, file_path, is_transpose=False):
    if is_transpose:
        return get_row_index(source_dir, file_path)

    with open_hdf5_file(source_dir, file_path) as f:
        dim_1 = [x.decode("utf-8") for x in list(f["dim_1"])]
        assert f["data"].shape[1] == len(dim_1)
        return dim_1


def get_non_na_rows_and_columns(source_dir, file_path):
    with open_hdf5_file(source_dir, file_path) as f:
        m = f["data"][:]
        per_row = np.apply_along_axis(lambda x: all(np.isnan(x)), 0, m)
        per_col = np.apply_along_axis(lambda x: all(np.isnan(x)), 1, m)
        return per_col, per_row


def get_values_min_max(source_dir, file_path):
    """
    np.nanmin and np.nanmax return numpy dtypes. If this inserted into the db then queried, we get native python types out.
    However, calling .asscalar is done here to explicitly convert to native python types because this conversion does not seem to happen in tests when the objects are created using factories.
    """
    with open_hdf5_file(source_dir, file_path) as f:
        df = pd.DataFrame(f["data"][:])
        assert (
            len(df.values) > 0
        ), "We should never have an empty matrix, but {} appears to be shaped {}".format(
            file_path, df.shape
        )

        min = np.nanmin(df.values)
        max = np.nanmax(df.values)
        return (min.item(), max.item())


def open_hdf5_file(source_dir, file_path):
    file_path = os.path.join(source_dir, file_path)
    assert os.path.exists(file_path), "{} does not exist".format(file_path)

    return h5py.File(file_path, "r")


def write(file_path, matrix):
    with h5py.File(file_path, "w") as f:
        f.create_dataset("data", dtype="f", data=matrix)


def csv_to_hdf5(source, destination):
    """
    The errors here are directly shown to the front end for user uploaded custom datasets.
    Probably this is just bad practice.
    But for the timebeing, we only catch errors in specific lines.
    :transpose: only used by nonstandard loader for private datasets
    """
    try:
        df = pd.read_csv(source, index_col=0)
    except Exception as e:
        # if there are any errors here, don't create the file
        raise MatrixConversionException(e)

    # handle case where we have an empty value in the index. This seems like it may be
    # bad data, but this existed in at least one private upload, so cope with that here
    df.index = [x if not pd.isna(x) else "" for x in df.index]

    df_to_hdf5(df, destination)


def df_to_hdf5(df, destination):
    """
    The errors here are directly shown to the front end for user uploaded custom datasets.
    Probably this is just bad practice.
    But for the timebeing, we only catch errors in specific lines.
    """
    dest = h5py.File(
        destination, mode="w"
    )  # don't catch errors here, e.g. if destination is invalid, error message reveals directory structure

    try:
        dest["dim_0"] = [x.encode("utf-8") for x in df.index]
        dest["dim_1"] = [x.encode("utf-8") for x in df.columns]
        dest.create_dataset("data", dtype="f", compression=None, data=df)
    except Exception as e:
        os.remove(destination)
        raise MatrixConversionException(e)
    dest.close()


# Copied from pipeline.scripts.hdf5_utils
def read_hdf5(filename):
    src = h5py.File(filename, "r")
    try:
        dim_0 = [x.decode("utf8") for x in src["dim_0"]]
        dim_1 = [x.decode("utf8") for x in src["dim_1"]]
        data = np.array(src["data"])
        return pd.DataFrame(index=dim_0, columns=dim_1, data=data)
    finally:
        src.close()
