from typing import Callable, Dict, List, Optional, Union

import os
import json
import numpy as np
import pandas as pd
import logging

import pytest

from depmap_compute.models import AnalysisType
from dataclasses import dataclass
from opencensus.trace import execution_context
from .lin_associations import lin_associations_wrapper

log = logging.getLogger(__name__)


@dataclass
class Feature:
    label: str
    slice_id: str


def assert_df_format(df, expected_columns, ignore_extra_columns=True):
    # compute an index of column name -> type
    df_column_types = dict(zip(df.columns, df.dtypes))

    unverified_columns = set(df_column_types.keys())
    problems = []
    for name, type in expected_columns:
        if name not in df_column_types:
            problems.append(f"missing column {name}")
            continue
        unverified_columns.remove(name)
        if df_column_types[name] != type:
            problems.append(
                f"expected column {name} to have type {type} but was {df_column_types[name]}"
            )
            continue

    if not ignore_extra_columns:
        if len(unverified_columns) > 0:
            extra_columns = list(unverified_columns)
            problems.append(f"extra columns: {extra_columns}")

    assert (
        len(problems) == 0
    ), f"Found following problems: {problems} in dataframe: {df}"


@dataclass
class CustomAnalysisResult:
    data_json_file_path: str  # this is a special key that will be processed by the status endpoint to a dict with the key "data"
    total_rows: int


def _run_lm(
    update_message: Callable[[str], None],
    dataset: np.ndarray,
    value_query_vector: Union[List[int], List[float]],
    features: List[Feature],
    vector_is_dependent: bool,
) -> CustomAnalysisResult:
    assert vector_is_dependent is not None

    # only supporting AnalysisType.two_class

    update_message("Running two class comparison...")

    df = lin_associations_wrapper(
        dataset.transpose(), value_query_vector, vector_is_dependent
    )
    df = df[
        [
            "betahat",
            "sebetahat",
            "NegativeProb",
            "PositiveProb",
            "lfsr",
            "svalue",
            "lfdr",
            "qvalue",
            # "qvalue_rob",
            # "p.val_rob",
            "PosteriorMean",
            "PosteriorSD",
            "dep.var",
            "ind.var",
            "p.val",
            "Index",
        ]
    ]

    if len(df) == 0:
        # specific error to report back to the user
        raise Exception("Error: Running this analysis returned no results")

    # rows in the df are entities in the matrix

    expected_columns = [
        "betahat",
        "sebetahat",
        "NegativeProb",
        "PositiveProb",
        "lfsr",
        "svalue",
        "lfdr",
        "qvalue",
        # "qvalue_rob",
        # "p.val_rob",
        "PosteriorMean",
        "PosteriorSD",
        "dep.var",
        "ind.var",
        "p.val",
        "Index",
    ]
    assert list(df.columns) == expected_columns, "columns not expected: {}".format(
        df.columns
    )

    df = df[
        [
            "Index",
            "PosteriorMean",
            "p.val",
            "qvalue",
            # 'p.val_rob', 'qvalue_rob'
        ]
    ]
    df = df.rename(
        columns={
            "PosteriorMean": "EffectSize",
            "p.val": "PValue",
            "qvalue": "QValue",
            # "p.val_rob": "PValue_Rob", "qvalue_rob": "QValue_Rob"
        },
    )

    # sort by descending absolute
    df = df.reindex(df.EffectSize.abs().sort_values(ascending=False).index)

    # Note that the df returned for pearson may have a different number rows from the df returned from the linear model
    # The df may also have fewer indices than row indices
    # Edge cases that caused these may be one-point rows, two-point rows, vector with no variance
    # (This is just a warning, unclear which of these situations cause dropping rows. no variance vector definitely does))#

    # Merge in label, vectorId and numCellLines
    num_cell_lines_used_in_calc = count_num_non_nan_per_row(dataset)

    # Add metadata

    row_labels = []
    vector_ids = []
    num_cell_lines = []
    for i in df["Index"]:
        row_labels.append(features[i].label)
        vector_ids.append(features[i].slice_id)
        # need to do this because num_cell_lines_used_in_calc isn't mapped by index, but rather by position
        num_cell_lines.append(num_cell_lines_used_in_calc[i])
    df["label"] = row_labels
    df["vectorId"] = vector_ids
    df["numCellLines"] = num_cell_lines

    # Clean up dataframe
    del df["Index"]

    return df


def write_custom_analysis_table(df, result_task_dir, effect_size_column):
    assert_df_format(
        df,
        [
            ("label", object),
            (
                "vectorId",
                object,
            ),  # depmap uses a string slice_id, breadbox uses an int feature_catalog_node.id
            ("numCellLines", np.int64),
            (effect_size_column, np.float64),
            ("QValue", np.float64),
            ("PValue", np.float64),
            # ("QValue_Rob", np.float64),
            # ("PValue_Rob", np.float64),
        ],
        ignore_extra_columns=False,
    )

    df_dict = df.replace({np.nan: None}).to_dict(orient="records")

    # Assemble result
    data_json_file_path = os.path.join(result_task_dir, "results.json")
    with open(data_json_file_path, "wt") as fd:
        fd.write(json.dumps(df_dict))
    return data_json_file_path


from opencensus.trace.span import Span
from opencensus.trace.tracers import base


def _print_span_debug_info(msg, span: Span):
    lineage = []
    if isinstance(span, Span):
        while span is not None:
            lineage.append(f"(name={span.name} id={span.span_id})")
            if isinstance(span, base.NullContextManager):
                span = None
            else:
                span = span.parent_span

    print(msg, " -> ".join(lineage))


def reformat_pearson_result(
    df: pd.DataFrame,
    dataset: np.ndarray,
    _num_cell_lines_used_in_calc,
    features: List[Feature],
) -> pd.DataFrame:
    # import pdb; pdb.set_trace()
    # sort by descending absolute
    df = df.reindex(df.Cor.abs().sort_values(ascending=False).index)

    # Note that the df returned for pearson may have a different number rows from the df returned from the linear model
    # The df may also have fewer indices than row indices
    # Edge cases that caused these may be one-point rows, two-point rows, vector with no variance
    # (This is just a warning, unclear which of these situations cause dropping rows. no variance vector definitely does))#

    num_cell_lines_used_in_calc = count_num_non_nan_per_row(dataset)

    # since prep_and_run_py_pearson already returns this, just double check that we got the same result
    assert (num_cell_lines_used_in_calc == _num_cell_lines_used_in_calc).all()

    # Add metadata
    row_labels = []
    vector_ids = []
    num_cell_lines = []

    # We assume num_cell_lines_used in calc is ordered in ascending
    # order of feature position based on the previous dep_mat_row_indices
    sorted_df_index = sorted(df.index)

    for i in list(df.index):
        index = sorted_df_index.index(i)
        row_labels.append(features[index].label)
        vector_ids.append(features[index].slice_id)
        # need to do this because num_cell_lines_used_in_calc isn't mapped by index, but rather by position
        num_cell_lines.append(num_cell_lines_used_in_calc[index])
    df["label"] = row_labels
    df["vectorId"] = vector_ids
    df["numCellLines"] = num_cell_lines

    # temporary to help with testing
    metadata = {
        "row_labels": row_labels,
        "vector_ids": vector_ids,
        "num_cell_lines": num_cell_lines,
    }

    return df, metadata


def _local_run_pearson(
    update_message: Callable[[str], None],
    dataset: np.ndarray,
    value_query_vector: Union[List[int], List[float]],
    features: List[Feature],
) -> pd.DataFrame:
    assert np.isnan(value_query_vector).sum() == 0

    tracer = execution_context.get_opencensus_tracer()
    with tracer.span(name="_local_run_pearson") as span:
        _print_span_debug_info("in _local_run_pearson", span)

        update_message("Running Pearson correlation...")

        def progress_callback(fraction_complete):
            # assuming 10% of time is before computing correlations
            # and assume 10% of time is packaging results up
            if fraction_complete > 1:
                log.warning(
                    "fraction_complete should be between 0 and 1 but was %f",
                    fraction_complete,
                )
            update_message(
                "Running Pearson correlation...",
                percent_complete=((fraction_complete * 0.8 + 0.1) * 100),
            )

        with tracer.span(name="prep_and_run_py_pearson") as span:
            (
                pearson_cor,
                p_vals,
                q_vals,
                _num_cell_lines_used_in_calc,
            ) = prep_and_run_py_pearson(value_query_vector, dataset, progress_callback)

            # verify that the indices of the dep_mat_col_indices list can line up with that of the pearson list
            # assert len(features) == len(pearson_cor)  # pearson_cor is a numpy array

            df = pd.DataFrame(
                {
                    "Cor": pearson_cor,
                    "PValue": p_vals,
                    "QValue": q_vals,
                    # "PValue_Rob": np.full(p_vals.shape, np.nan), 'QValue_Rob': np.full(q_vals.shape, np.nan)
                }
            )

        with tracer.span(name="reformat_result") as span:
            df, metadata = reformat_pearson_result(
                df, dataset, _num_cell_lines_used_in_calc, features
            )

    return df


def _make_result_task_directory(result_dir, task_id):
    result_task_dir = os.path.join(result_dir, task_id)
    os.makedirs(result_task_dir)
    return result_task_dir


def _run_custom_analysis(
    task_id,
    update_message: Callable[[str], None],
    analysis_type: str,
    depmap_model_ids: List[str],
    value_query_vector: Union[List[int], List[float]],
    features: List[Feature],
    feature_type: Optional[str],
    dataset: np.ndarray,
    vector_is_dependent: Optional[bool],
    parameters: Dict,
    result_dir: str,
    create_cell_line_group: Callable[[List[str], bool], str],
    use_feature_ids: bool = False,
):
    """
    Notes:
        - lm and pearson will both run with only 2 points. pearson will just return cor 1, and p val and q val NaN
        - if there is only 1 point (e.g. due to NaNs), the code will leave out the entity. lmstats and pearson each individually drop it before the merge
    """
    update_message("Loading...")

    # in views.py, the asserts check user input. this checks that vectors after querying database are the same
    assert len(depmap_model_ids) > 0

    result_task_dir = _make_result_task_directory(result_dir, task_id)

    write_params(
        result_task_dir,
        analysis_type,
        value_query_vector,
        vector_is_dependent,
        parameters,
        result_dir,
    )

    if analysis_type == AnalysisType.pearson:
        df = _local_run_pearson(update_message, dataset, value_query_vector, features)
        effect_size_column = "Cor"
    else:
        assert vector_is_dependent is not None
        df = _run_lm(
            update_message, dataset, value_query_vector, features, vector_is_dependent
        )
        effect_size_column = "EffectSize"

    data_json_file_path = write_custom_analysis_table(
        df, result_task_dir, effect_size_column
    )

    total_rows = df.shape[0]

    r = CustomAnalysisResult(
        data_json_file_path=data_json_file_path, total_rows=total_rows,
    )

    if analysis_type == AnalysisType.two_class:
        in_group = subset_cell_lines_by_values(
            parameters["query"]["queryCellLines"], parameters["query"]["queryValues"],
        )
        color_slice_id = create_cell_line_group(in_group, use_feature_ids)
    else:
        color_slice_id = None

    filter_slice_id = create_cell_line_group(
        parameters["query"]["queryCellLines"], use_feature_ids
    )

    num_cell_lines = (
        0
        if parameters["query"]["queryCellLines"] == None
        else len(parameters["query"]["queryCellLines"])
    )
    result = {
        "taskId": task_id,
        "data_json_file_path": r.data_json_file_path,
        # this is a special key that will be processed by the status endpoint to a dict with the key "data"
        "totalRows": r.total_rows,
        "numCellLinesUsed": num_cell_lines,
        "filterSliceId": filter_slice_id,
        "colorSliceId": color_slice_id,
        "entityType": feature_type,
        "analysisType": analysis_type,
    }

    update_message("Wrapping up final calculations...")

    return result


def subset_cell_lines_by_values(cell_lines, values):
    in_group_cell_lines = [
        cell_line for cell_line, value in zip(cell_lines, values,) if value == 1
    ]
    return in_group_cell_lines


def write_params(
    result_task_dir,
    analysis_type,
    value_query_vector,
    vector_is_dependent,
    parameters,
    result_dir,
):
    params = {
        "analysis_type": analysis_type,
        "value_query_vector": value_query_vector,
        "vector_is_dependent": vector_is_dependent,
        "parameters": parameters,
    }
    params_path = os.path.join(result_task_dir, "params.json")
    with open(params_path, "w") as f:
        json.dump(params, f)


def count_num_non_nan_per_row(matrix):
    """
    Exclude nan and infinity, because both pearson and the R code exclude from their analysis
    """
    return (np.isfinite(matrix)).sum(axis=1)


def prep_and_run_py_pearson(value_query_vector, dep_mat, progress_callback):
    vector_for_pearson = np.asarray([value_query_vector], dtype=float).transpose()

    pearson_cor, p_vals, q_vals, num_cell_lines_used_in_calc = run_pearson(
        vector_for_pearson, dep_mat.transpose(), progress_callback
    )
    return pearson_cor, p_vals, q_vals, num_cell_lines_used_in_calc


def run_custom_analysis(
    task_id,
    update_message,
    analysis_type: str,
    depmap_model_ids: List[str],
    value_query_vector: Union[List[int], List[float]],
    features: List[Feature],
    feature_type: Optional[str],
    dataset: np.ndarray,
    vector_is_dependent: Optional[bool],
    parameters: Dict,
    result_dir: str,
    create_cell_line_group: Callable[[List[str], bool], str],
    use_feature_ids: bool,
):
    """
    :param self:
    :param analysis_type: The type of analysis
    :param dep_mat_col_indices: The indices of the columns to search (may be a subset of the matrix)
    :param dataset_id: The id of the dataset to search.
    :param value_query_vector: The query profile to search for
    :param vector_is_dependent:
    :param parameters: Additional parameters to return in the response when we're done
    :param result_dir: The directory to write results to
    :param ctx: A dict containing the result of Analysis(...), which consists of variables required to complete the cust analysis
    :return:
    """

    return _run_custom_analysis(
        task_id,
        update_message,
        analysis_type,
        depmap_model_ids,
        value_query_vector,
        features,
        feature_type,
        dataset,
        vector_is_dependent,
        parameters,
        result_dir,
        create_cell_line_group,
        use_feature_ids,
    )


def run_pearson(vector, matrix_subsetted, progress_callback):
    """
    Just runs python, no call to R. The "for_run_custom_analysis" in the name just refers to where it is used, in the _run_custom_analysis
    """
    (
        pearson_cor,
        p_vals,
        q_vals,
        values_used_in_calc,
    ) = fast_cor_with_p_and_q_values_with_missing(
        vector, matrix_subsetted, progress_callback
    )
    assert pearson_cor.shape[0] == 1
    assert p_vals.shape[0] == 1
    assert q_vals.shape[0] == 1
    pearson_cor = pearson_cor[0]
    p_vals = p_vals[0]
    q_vals = q_vals[0]
    values_used_in_calc = values_used_in_calc[0]
    return pearson_cor, p_vals, q_vals, values_used_in_calc


def fast_cor_with_p_and_q_values_with_missing(x, y, progress_callback):
    # preallocate storage for the result
    result = np.zeros(shape=(x.shape[1], y.shape[1]))
    p_vals = np.zeros(shape=(x.shape[1], y.shape[1]))
    q_vals = np.zeros(shape=(x.shape[1], y.shape[1]))
    num_used_in_calc = np.zeros(shape=(x.shape[1], y.shape[1]))

    x_groups = group_cols_with_same_mask(x)
    y_groups = group_cols_with_same_mask(y)

    counter = 0
    total_iterations = len(x_groups) * len(y_groups)

    progress_callback(0)
    for x_mask, x_columns in x_groups:
        for y_mask, y_columns in y_groups:
            counter = counter + 1
            combined_mask = x_mask & y_mask

            # not sure if this is the fastest way to slice out the relevant subset
            x_without_holes = x[:, x_columns][combined_mask, :]
            y_without_holes = y[:, y_columns][combined_mask, :]

            c = np_pearson_cor(x_without_holes, y_without_holes)
            # update result with these correlations
            result[np.ix_(x_columns, y_columns)] = c

            n = x_without_holes.shape[0]
            p, q = _calc_cor_pq_values(n, c)
            p_vals[np.ix_(x_columns, y_columns)] = p
            q_vals[np.ix_(x_columns, y_columns)] = q

            num_used_in_calc[np.ix_(x_columns, y_columns)] = len(x_without_holes)
            progress_callback(counter / total_iterations)

    return result, p_vals, q_vals, num_used_in_calc


def _calc_cor_pq_values(n, c):
    # n is the number of pairs of values used to compute the correlation
    # c is the pearson correlation for which we want the p-value
    from scipy import stats

    dist = stats.beta(n / 2 - 1, n / 2 - 1, loc=-1, scale=2)
    p = 2 * dist.cdf(-abs(c))

    if np.isfinite(p).all():
        q = stats.false_discovery_control(p, axis=1)
    else:
        q = np.array(p)
        q[np.isfinite(p)] = stats.false_discovery_control(p[np.isfinite(p)])
    return p, np.asarray(q)


def group_cols_with_same_mask(x):
    """
    Group columns with the same indexes of NAN values.

    Return a sequence of tuples (mask, columns) where columns are the column indices
    in x which all have the mask.
    """
    per_mask = {}
    for i in range(x.shape[1]):
        o_mask = np.isfinite(x[:, i])
        o_mask_b = np.packbits(o_mask).tobytes()
        if o_mask_b not in per_mask:
            per_mask[o_mask_b] = [o_mask, []]
        per_mask[o_mask_b][1].append(i)
    return per_mask.values()


def np_pearson_cor(x, y):
    """Full column-wise Pearson correlations of two matrices."""
    xv = x - x.mean(axis=0)
    yv = y - y.mean(axis=0)
    xvss = (xv * xv).sum(axis=0)
    yvss = (yv * yv).sum(axis=0)
    # print(xvss, yvss)
    # print(np.matmul(xv.transpose(), yv) , np.sqrt(np.outer(xvss, yvss)))
    result = np.matmul(xv.transpose(), yv) / np.sqrt(np.outer(xvss, yvss))
    return np.maximum(np.minimum(result, 1.0), -1.0)
