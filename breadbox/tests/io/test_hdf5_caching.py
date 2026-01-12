import time

import numpy as np
import pandas as pd
from pyarrow.dataset import dataset

from breadbox.schemas.dataframe_wrapper import (
    ParquetDataFrameWrapper,
    PandasDataFrameWrapper,
    HDF5DataFrameWrapper,
)
from breadbox.schemas.custom_http_exception import LargeDatasetReadError
from breadbox.io.hdf5_utils import (
    write_hdf5_file,
    read_hdf5_file,
    DUPLICATE_STORAGE,
    CHUNKED_STORAGE,
)
import pytest
import h5py
from pandas.testing import assert_frame_equal

TEST_COLUMN_COUNT = 20


def create_sample_data(row_length: int, col_length: int):
    cols = [f"Col-{i}" for i in range(col_length)]
    rows = [f"Row-{i}" for i in range(row_length)]
    data = np.random.uniform(0.0, 10.0, size=(row_length, col_length))
    test_df = pd.DataFrame(data, columns=cols, index=rows)
    return test_df


def test_hdf5_cache_correctness(tmpdir):
    # make sure the two caching modes yield the same results as no cache

    expected_df = create_sample_data(100, 200)
    ref_path = str(tmpdir.join("ref"))
    write_hdf5_file(ref_path, PandasDataFrameWrapper(expected_df), dtype="float")

    df = read_hdf5_file(ref_path)
    assert_frame_equal(df, expected_df)

    for cache_strategy in [DUPLICATE_STORAGE, CHUNKED_STORAGE]:
        for params in [
            dict(feature_indexes=None, sample_indexes=None),
            dict(feature_indexes=[1, 2, 5, 6], sample_indexes=None),
            dict(feature_indexes=None, sample_indexes=[1, 2, 5, 6]),
            dict(feature_indexes=[2, 4], sample_indexes=[1, 2, 5, 6]),
            dict(feature_indexes=[1, 2, 5, 6], sample_indexes=[2, 4]),
        ]:

            expected_df = read_hdf5_file(ref_path, keep_nans=True, **params)
            from_cache_df = read_hdf5_file(
                ref_path, keep_nans=True, cache_strategy=cache_strategy, **params
            )

            assert_frame_equal(from_cache_df, expected_df)


def benchmark(label, callback, min_iterations=3, min_time=1):
    # first call once to warm up the cache
    print(f"Starting benchmark of {label}")
    callback()
    timings = []
    iteration = 0
    total_elapsed = 0
    while True:
        start = time.perf_counter()
        callback()
        end = time.perf_counter()
        elapsed = end - start
        total_elapsed += elapsed
        timings.append(elapsed)
        iteration += 1
        if iteration >= min_iterations and total_elapsed >= min_time:
            break

    print(
        f"{label}: mean {np.mean(timings):.4} sec std {np.std(timings):.4} ({iteration} iterations)"
    )


import random
import os
import datetime


def perf_test(dest_dir, rows, columns):
    os.makedirs(dest_dir, exist_ok=True)

    expected_df = create_sample_data(rows, columns)
    ref_path = f"{dest_dir}/ref-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}"
    print(f"Creating {ref_path}")
    write_hdf5_file(ref_path, PandasDataFrameWrapper(expected_df), dtype="float")
    for cache_strategy in [None, DUPLICATE_STORAGE, CHUNKED_STORAGE]:
        # benchmark(f"cache_strategy={cache_strategy}: read full", lambda: read_hdf5_file(ref_path, feature_indexes=None, sample_indexes=None, keep_nans=True, cache_strategy=cache_strategy))

        for sample_size in [1, 5, 100]:
            benchmark(
                f"cache_strategy={cache_strategy}: read {sample_size} columns",
                lambda: read_hdf5_file(
                    ref_path,
                    feature_indexes=sorted(random.sample(range(columns), sample_size)),
                    sample_indexes=None,
                    keep_nans=True,
                    cache_strategy=cache_strategy,
                ),
            )

            benchmark(
                f"cache_strategy={cache_strategy}: read {sample_size} row",
                lambda: read_hdf5_file(
                    ref_path,
                    feature_indexes=None,
                    sample_indexes=sorted(random.sample(range(rows), sample_size)),
                    keep_nans=True,
                    cache_strategy=cache_strategy,
                ),
            )


import argparse

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("dir")
    parser.add_argument("rows", type=int)
    parser.add_argument("cols", type=int)

    args = parser.parse_args()

    perf_test(args.dir, args.rows, args.cols)
