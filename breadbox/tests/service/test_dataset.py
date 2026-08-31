from breadbox.schemas.dataset import AggregationMethod
from breadbox.service.dataset import (
    _aggregate_matrix_df,
    _chunked_aggregate_matrix_df,
)
import pandas as pd
import numpy as np
from pandas.testing import assert_frame_equal
import pytest


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


@pytest.mark.parametrize(
    "method,expected_df",
    [
        (
            AggregationMethod.mean,
            pd.DataFrame({"mean": [6.4, 6.5]}, index=["A", "B"]),  # pyright: ignore
        ),
        (
            AggregationMethod.stddev,
            pd.DataFrame(
                {"stddev": [8.38451, 1.870829]}, index=["A", "B"]  # pyright: ignore
            ),
        ),
        (
            AggregationMethod.per25,
            pd.DataFrame({"25%tile": [1, 5.25]}, index=["A", "B"]),  # pyright: ignore
        ),
        (
            AggregationMethod.per75,
            pd.DataFrame({"75%tile": [9, 7.75]}, index=["A", "B"]),  # pyright: ignore
        ),
        (
            AggregationMethod.median,
            pd.DataFrame({"median": [2, 6.50]}, index=["A", "B"]),  # pyright: ignore
        ),
        (
            AggregationMethod.sum,
            pd.DataFrame({"sum": [32.0, 39.0]}, index=["A", "B"]),  # pyright: ignore
        ),
        (
            AggregationMethod.variance,
            pd.DataFrame(
                {"variance": [70.3, 3.5]}, index=["A", "B"]  # pyright: ignore
            ),
        ),
        (
            AggregationMethod.count,
            # A has a NaN, so it counts one fewer than B.
            pd.DataFrame({"count": [5, 6]}, index=["A", "B"]),  # pyright: ignore
        ),
    ],
)
def test_aggregate_matrix_methods(method, expected_df):
    df = pd.DataFrame(
        {"A": [1, 2, 0, np.nan, 9, 20], "B": [4, 5, 6, 7, 9, 8]},
        index=["a", "b", "c", "d", "e", "f"],  # pyright: ignore
    )

    agg_df = _aggregate_matrix_df(df, "samples", method)

    assert_frame_equal(agg_df, expected_df)


def test_aggregate_matrix_several_methods():
    df = pd.DataFrame(
        {"A": [1, 2, 0, np.nan, 9, 20], "B": [4, 5, 6, 7, 9, 8]},
        index=["a", "b", "c", "d", "e", "f"],  # pyright: ignore
    )

    for use_chunking in [True, False]:
        agg_df = _aggregate_matrix_df(
            df,
            "samples",
            [AggregationMethod.variance, AggregationMethod.count],
            use_chunking=use_chunking,
        )

        # One column per method, named for its wire value and in the order
        # asked for. Each column is identical to what the method produces on
        # its own.
        expected_df = pd.DataFrame(
            {"variance": [70.3, 3.5], "count": [5, 6]},
            index=["A", "B"],  # pyright: ignore
        )
        assert_frame_equal(agg_df, expected_df)


def test_aggregate_matrix_count_survives_an_empty_column():
    # The case the count exists for: a member with too few observations to say
    # anything about. Its spread is undefined, but its count still reads 0/1 --
    # which is how a caller tells "no signal" from "not measured".
    df = pd.DataFrame(
        {"empty": [np.nan, np.nan, np.nan], "single": [np.nan, 5.0, np.nan]},
        index=["a", "b", "c"],  # pyright: ignore
    )

    agg_df = _aggregate_matrix_df(
        df, "samples", [AggregationMethod.variance, AggregationMethod.count]
    )

    expected_df = pd.DataFrame(
        {"variance": [np.nan, np.nan], "count": [0, 1]},
        index=["empty", "single"],  # pyright: ignore
    )
    assert_frame_equal(agg_df, expected_df)


def test_aggregate_matrix_empty_aggregated_axis():
    # A subset that matched nothing on the axis being collapsed -- which is what
    # a caller gets by asking for ids that aren't in this dataset. The chunking
    # arithmetic used to size a chunk by dividing by that axis's length, so this
    # raised ZeroDivisionError and surfaced as a 500 rather than as "nothing was
    # measured".
    no_samples = pd.DataFrame(
        {"A": pd.Series(dtype=float), "B": pd.Series(dtype=float)}
    )

    for use_chunking in [True, False]:
        agg_df = _aggregate_matrix_df(
            no_samples,
            "samples",
            [AggregationMethod.mean, AggregationMethod.count],
            use_chunking=use_chunking,
        )

        # Every feature survives, with no observations behind it. `count` of 0
        # is the honest answer and is exactly how a caller distinguishes this
        # from a feature that was measured and happened to be flat.
        expected_df = pd.DataFrame(
            {"mean": [np.nan, np.nan], "count": [0, 0]},
            index=["A", "B"],  # pyright: ignore
        )
        assert_frame_equal(agg_df, expected_df)


def test_aggregate_matrix_empty_chunked_axis():
    # The mirror image: nothing left on the axis being iterated over. The loop
    # never ran, so pd.concat got an empty list and raised "No objects to
    # concatenate".
    no_samples = pd.DataFrame(
        {"A": pd.Series(dtype=float), "B": pd.Series(dtype=float)}
    )

    for use_chunking in [True, False]:
        agg_df = _aggregate_matrix_df(
            no_samples, "features", AggregationMethod.mean, use_chunking=use_chunking
        )

        assert len(agg_df) == 0


def test_aggregate_matrix_slice_larger_than_chunk_budget():
    # Chunking cannot help when a single slice already exceeds the budget: the
    # floor division yields 0 and range() rejects a zero step. Aggregating in
    # one go is the only option left, and it must still be correct.
    df = pd.DataFrame(
        {"A": [1.0, 2.0], "B": [3.0, 4.0]}, index=["a", "b"]  # pyright: ignore
    )

    aggregated = _chunked_aggregate_matrix_df(df, 0, "mean", chunk_size_in_mb=0)

    assert aggregated.to_dict() == {"A": 1.5, "B": 3.5}


def test_aggregate_matrix_chunking_df():
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
