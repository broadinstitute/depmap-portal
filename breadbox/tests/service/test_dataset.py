from breadbox.schemas.dataset import AggregationMethod
from breadbox.service.dataset import _aggregate_matrix_df
import pandas as pd
import numpy as np
from pandas.testing import assert_frame_equal


def test_aggregate_stddev():
    df = pd.DataFrame(
        {"A": [1, 2, 0, np.nan], "B": [4, 5, 6, 7]},
        index=["a", "b", "c", "d"],  # pyright: ignore
    )

    agg_df = _aggregate_matrix_df(df, "samples", AggregationMethod.stddev)
    # fmt: off
    expected_df = pd.DataFrame(
        {"stddev": [1, 1.290994]}, index=["A", "B"]  # pyright: ignore
    )
    # fmt: on
    assert_frame_equal(agg_df, expected_df)


def test_aggregate_matrix_df():
    df = pd.DataFrame(
        {"A": [1, 2, 0, np.nan], "B": [4, 5, 6, 7]},
        index=["a", "b", "c", "d"],  # pyright: ignore
    )

    # make sure chunking and non-chunking behavior are identical
    for use_chunking in [True, False]:
        # mean per sample
        expected_df = pd.DataFrame(
            {"mean": [2.5, 3.5, 3, 7]}, index=["a", "b", "c", "d"]  # pyright: ignore
        )
        agg_df = _aggregate_matrix_df(
            df, "features", AggregationMethod.mean, use_chunking=use_chunking
        )
        assert_frame_equal(agg_df, expected_df)

        # mean per feature

        agg_df = _aggregate_matrix_df(
            df, "samples", AggregationMethod.mean, use_chunking=use_chunking
        )
        # fmt: off
        expected_df = pd.DataFrame(
            {"mean": [1, 22.0 / 4]}, index=["A", "B"] # pyright: ignore
        )
        # fmt: on
        assert_frame_equal(agg_df, expected_df)
