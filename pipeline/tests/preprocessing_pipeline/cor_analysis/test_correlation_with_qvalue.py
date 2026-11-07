import numpy as np
import pandas as pd
import pytest
from scipy import stats

from conftest import load_script

cwq = load_script("preprocessing-pipeline/cor_analysis/correlation_with_qvalue.py")


def test_np_pearson_cor():
    # rows are samples, columns are features
    x = np.array([[1.0, 4.0], [2.0, 3.0], [3.0, 2.0], [4.0, 1.0]])
    y = np.array([[2.0, 1.0], [4.0, 3.0], [6.0, 2.0], [8.0, 4.0]])

    result = cwq.np_pearson_cor(x, y)

    # x[:, 0] is perfectly correlated with y[:, 0]; x[:, 1] is perfectly anti-correlated
    # the remaining entries work out to +/-0.8
    np.testing.assert_allclose(result, [[1.0, 0.8], [-1.0, -0.8]])


def test_fast_cor_with_missing_uses_only_pairwise_complete_rows():
    nan = np.nan
    x = np.array([[1.0, 1.0], [2.0, 2.0], [3.0, 3.0], [4.0, 4.0], [nan, 5.0],])
    y = np.array([[1.0], [3.0], [2.0], [nan], [5.0]])

    cor, counts = cwq.fast_cor_with_missing(x, y, min_number_of_points=3)

    # x[:, 0] vs y: rows 0-2 are complete -> x=[1,2,3], y=[1,3,2] -> r=0.5
    # x[:, 1] vs y: rows 0,1,2,4 are complete -> x=[1,2,3,5], y=[1,3,2,5] -> r=31/35
    np.testing.assert_array_equal(counts, [[3], [4]])
    np.testing.assert_allclose(cor, [[0.5], [31 / 35]])


def test_fast_cor_with_missing_nan_below_min_points():
    x = np.array([[1.0], [2.0], [3.0], [np.nan]])
    y = np.array([[1.0], [2.0], [np.nan], [4.0]])

    cor, counts = cwq.fast_cor_with_missing(x, y, min_number_of_points=3)

    assert counts[0, 0] == 2
    assert np.isnan(cor[0, 0])


def test_group_cols_with_same_mask():
    x = np.array([[1, 1, np.nan], [np.nan, np.nan, 1], [1, 1, 1]])

    groups = {tuple(cols) for _, cols in cwq.group_cols_with_same_mask(x)}

    assert groups == {(0, 1), (2,)}


def test_calc_cor_pq_values_matches_scipy_pearsonr():
    rng = np.random.default_rng(2)
    a = rng.normal(size=25)
    b = a + rng.normal(size=25)
    r, expected_p = stats.pearsonr(a, b)

    p, q = cwq._calc_cor_pq_values(np.array([[25]]), np.array([[r]]))

    assert p[0, 0] == pytest.approx(expected_p)
    # a single p-value is its own q-value
    assert q[0, 0] == pytest.approx(expected_p)


def test_calc_cor_pq_values_all_nan():
    p, q = cwq._calc_cor_pq_values(np.array([[10, 10]]), np.array([[np.nan, np.nan]]))

    assert np.isnan(p).all()
    assert np.isnan(q).all()


def test_fdr_correct_column_preserves_nans():
    p = np.array([0.01, np.nan, 0.04, 0.03])

    q = cwq.fdr_correct_column(p)

    assert np.isnan(q[1])
    np.testing.assert_allclose(
        q[[0, 2, 3]], stats.false_discovery_control(p[[0, 2, 3]])
    )


def test_chunk():
    assert list(cwq.chunk([1, 2, 3, 4, 5], 2)) == [[1, 2], [3, 4], [5]]


def test_with_shared_cell_lines():
    a = pd.DataFrame({"x": [1, 2, 3]}, index=["ACH-1", "ACH-2", "ACH-3"])
    b = pd.DataFrame({"y": [4, 5, 6]}, index=["ACH-3", "ACH-1", "ACH-9"])

    a2, b2 = cwq.with_shared_cell_lines(a, b)

    assert list(a2.index) == ["ACH-1", "ACH-3"]
    assert list(b2.index) == ["ACH-1", "ACH-3"]
    assert list(b2["y"]) == [5, 4]


def test_filter_df_applies_qvalue_cutoff():
    df = pd.DataFrame({"cor": [0.9, -0.8, 0.1], "qvalue": [0.01, 0.5, 0.01]},)

    result = cwq.filter_df(df, limit=10, limit_per_sign=10, max_qvalue=0.1)

    assert list(result.index) == [0, 2]


def test_get_paren_values():
    names = ["SOX10 (6663)", "ENSG-like (ENSG00000001)", "no_parens"]

    assert cwq._get_paren_values(names) == ["6663", "ENSG00000001", None]


def test_map_to_given_ids_label_passthrough():
    mat = pd.DataFrame([[1, 2]], columns=["a", "b"], index=["ACH-1"])

    result = cwq.map_to_given_ids(mat, {"feature_id_format": "gene"})

    # neither column matches "SYMBOL (id)", so both are dropped
    assert result.shape == (1, 0)

    result = cwq.map_to_given_ids(mat, {"feature_id_format": "label"})
    assert list(result.columns) == ["a", "b"]


def test_map_to_given_ids_unknown_format():
    mat = pd.DataFrame([[1]], columns=["a"], index=["ACH-1"])

    with pytest.raises(Exception, match="unknown feature_id_format"):
        cwq.map_to_given_ids(mat, {"feature_id_format": "bogus"})


def test_q_value_calc():
    rng = np.random.default_rng(0)
    n_columns = 20000
    samples = [f"sample_{i}" for i in range(50)]
    columns = [f"column_{i}" for i in range(n_columns)]
    matrix_a = pd.DataFrame(
        rng.normal(size=(50, n_columns)), index=samples, columns=columns
    )
    matrix_b = pd.DataFrame(
        rng.normal(size=(50, 2)), index=samples, columns=["b1", "b2"]
    )

    matrix_a.loc[:, "column_1"] = matrix_b.loc[:, "b2"] + rng.normal(size=50) * 0.01

    cor_df_1 = cwq.create_correlations_df(
        matrix_b,
        matrix_a,
        cwq.Thresholds(
            batch_size=2, limit=2, minsamples=4, limit_per_sign=3, max_qvalue=1
        ),
    )
    cor_df_2 = cwq.create_correlations_df(
        matrix_b,
        matrix_a,
        cwq.Thresholds(
            batch_size=1000, limit=2, minsamples=4, limit_per_sign=3, max_qvalue=1
        ),
    )
    # make sure the batch size doesn't impact the results
    pd.testing.assert_frame_equal(cor_df_1, cor_df_2, check_exact=False)

    # sanity check q-value: the smallest p-value should be scaled as if it was Bonferroni corrected
    best_cor_df = cor_df_1[cor_df_1["dim_1"] == 1 & cor_df_1["dim_0"]]
    best_cor_adj = float(best_cor_df["qvalue"] / best_cor_df["pvalue"])
    assert best_cor_adj == pytest.approx(n_columns, abs=1e-5)

    # everything else should have a value less than that
    adjustment = cor_df_1["qvalue"] / cor_df_1["pvalue"]
    assert (adjustment <= n_columns).all()


def test_small_end_to_end(tmp_path):
    from packed_cor_tables import read_cor_for_given_id

    output_file = str(tmp_path / "out.sqlite3")
    index = ["ACH-01", "ACH-02", "ACH-03", "ACH-04"]
    df_0 = pd.DataFrame(
        [[1, -1], [2, 1], [3, -1], [4, 1]], columns=["A", "B"], index=index
    )
    df_1 = pd.DataFrame(
        [[10, -10], [20, 10], [30, 10], [40, -10]], columns=["C", "D"], index=index
    )

    cwq.compute_cor_table(
        df_0,
        "X",
        "taiga-x",
        df_1,
        "Y",
        "taiga-y",
        output_file,
        cwq.Thresholds(
            batch_size=100, limit=100, minsamples=0, limit_per_sign=100, max_qvalue=100
        ),
    )

    rows = (
        read_cor_for_given_id(output_file, "A")
        .sort_values("feature_given_id_1")
        .to_dict("records")
    )
    assert [(r["feature_given_id_0"], r["feature_given_id_1"]) for r in rows] == [
        ("A", "C"),
        ("A", "D"),
    ]
    assert rows[0]["dataset_given_id_0"] == "X"
    assert rows[0]["dataset_given_id_1"] == "Y"
    assert rows[0]["cor"] == pytest.approx(1.0, abs=1e-5)
    assert rows[1]["cor"] == pytest.approx(0.0, abs=1e-5)
