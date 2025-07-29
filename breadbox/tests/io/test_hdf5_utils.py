# type: ignore
import numpy as np
import pandas as pd
from breadbox.schemas.dataframe_wrapper import (
    ParquetDataFrameWrapper,
    PandasDataFrameWrapper,
)
from breadbox.io.hdf5_utils import write_hdf5_file
import pytest
import h5py

from breadbox.utils.progress_tracker import ProgressTracker


@pytest.fixture
def test_dataframe(row_length: int = 500, col_length: int = 11000):
    cols = [f"Col-{i}" for i in range(col_length)]
    rows = [f"Row-{i}" for i in range(row_length)]
    data = np.round(np.random.uniform(0.0, 10.0, size=(row_length, col_length)), 6)
    test_df = pd.DataFrame(data, columns=cols, index=rows)
    return test_df


@pytest.fixture
def test_parquet_file(tmpdir, test_dataframe):
    # NOTE: the client reads in a dataframe with index as a column, so reset the index
    test_dataframe.reset_index(inplace=True)
    path = tmpdir.join("test.parquet")
    test_dataframe.to_parquet(path, index=False)
    return str(path)


def test_parquet_wrapper(tmpdir, test_dataframe, test_parquet_file):
    parquet_wrapper = ParquetDataFrameWrapper(parquet_path=test_parquet_file)
    assert parquet_wrapper.get_index_names() == test_dataframe["index"].to_list()
    assert parquet_wrapper.get_column_names() == test_dataframe.columns[1:].to_list()
    assert parquet_wrapper.read_columns(["Col-0", "Col-1"]).shape == (
        len(test_dataframe),
        2,
    )
    assert parquet_wrapper.is_sparse() == False
    assert parquet_wrapper.is_numeric_cols() == True
    with pytest.raises(Exception):
        parquet_wrapper.get_df()


def test_pandas_wrapper(tmpdir, test_dataframe):
    pandas_wrapper = PandasDataFrameWrapper(test_dataframe)
    assert pandas_wrapper.get_index_names() == test_dataframe.index.to_list()
    assert pandas_wrapper.get_column_names() == test_dataframe.columns.to_list()
    assert pandas_wrapper.read_columns(["Col-0", "Col-1"]).shape == (
        len(test_dataframe),
        2,
    )
    assert pandas_wrapper.is_sparse() == False
    assert pandas_wrapper.get_df().equals(test_dataframe)
    assert pandas_wrapper.is_numeric_cols() == True


def test_write_parquet_to_hdf5(tmpdir, test_dataframe, test_parquet_file):
    wrapper = ParquetDataFrameWrapper(parquet_path=test_parquet_file)
    output_h5 = tmpdir.join("output.h5")

    # override batch size to force multiple batches
    write_hdf5_file(
        path=str(output_h5),
        df_wrapper=wrapper,
        dtype="float",
        batch_size=1000,
        progress=ProgressTracker(),
    )

    # Verify output
    with h5py.File(output_h5, "r") as f:
        data = f["data"][:]
        assert data.shape == (500, 11000)
        # Check if the first column matches the first column of the original dataframe
        assert (data[:, 0] == test_dataframe.iloc[:, 1]).all()
        indices: h5py.Dataset = f["samples"][:]
        expected_indices = wrapper.get_index_names()
        assert indices[0].decode("utf-8") == expected_indices[0]
        assert len(indices) == len(expected_indices)
        expeted_columns = wrapper.get_column_names()
        columns: h5py.Dataset = f["features"][:]
        assert len(columns) == len(expeted_columns)


def test_write_parquet_nulls_to_hdf5(tmpdir):
    cols = [f"Col-{i}" for i in range(1000)]
    rows = [f"Row-{i}" for i in range(100)]
    # Generate random float data
    data = np.round(np.random.uniform(0.0, 10.0, size=(len(rows), len(cols))), 6)
    # Randomly assign NaNs to ~10% of the elements
    nan_mask = np.random.rand(*data.shape) < 0.1  # 10% NaNs
    data[nan_mask] = np.nan

    # Create DataFrame
    test_df = pd.DataFrame(data, columns=cols, index=rows).convert_dtypes()

    test_df.reset_index(inplace=True)

    path = tmpdir.join("test.parquet")
    test_df.to_parquet(str(path), index=False)

    wrapper = ParquetDataFrameWrapper(parquet_path=str(path))

    output_h5 = tmpdir.join("output.h5")

    # override batch size to force multiple batches
    write_hdf5_file(
        path=str(output_h5),
        df_wrapper=wrapper,
        dtype="float",
        batch_size=1000,
        progress=ProgressTracker(),
    )

    # Verify output
    with h5py.File(output_h5, "r") as f:
        data: h5py.Dataset = f["data"][:]
        assert data.shape == (100, 1000)
        # Check if the first column matches the first column of the original dataframe
        assert (data[:, 0] == test_df.iloc[:, 1]).all()
        indices: h5py.Dataset = f["samples"][:]
        expected_indices = wrapper.get_index_names()
        assert indices[0].decode("utf-8") == expected_indices[0]
        assert len(indices) == len(expected_indices)
        expeted_columns = wrapper.get_column_names()
        columns: h5py.Dataset = f["features"][:]
        assert len(columns) == len(expeted_columns)
