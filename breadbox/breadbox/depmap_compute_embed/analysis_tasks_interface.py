from typing import Callable, Dict, List, Optional, Union, Protocol

import os
import json
import numpy as np
import pandas as pd
import logging

from breadbox.depmap_compute_embed.models import AnalysisType
from dataclasses import dataclass

from .lin_associations import lin_associations_wrapper
from scipy import stats
from ..crud.dimension_ids import IndexedGivenIDDataFrame
import pandera as pa

from ..schemas.custom_http_exception import UserError

log = logging.getLogger(__name__)


class CustomAnalysisCallbacks(Protocol):
    def create_cell_line_group(
        self, model_ids: List[str], use_feature_ids: bool
    ) -> str:
        ...

    def get_dataset_df(self, feature_matrix_indices: List[int]) -> np.ndarray:
        ...

    def update_message(
        self, message=None, start_time=None, max_time: int = 45, percent_complete=None
    ):
        ...


class FeaturesExtDataFrame(IndexedGivenIDDataFrame):
    required_columns = ["given_id", "label", "slice_id"]

    def __init__(self, source: pd.DataFrame):
        super(FeaturesExtDataFrame, self).__init__(source)

    @property
    def slice_id(self):
        return self["slice_id"]

    @property
    def label(self):
        return self["label"]


@dataclass
class CustomAnalysisResult:
    data_json_file_path: str  # this is a special key that will be processed by the status endpoint to a dict with the key "data"
    total_rows: int


def _compute_lm_associations(
    dataset: np.ndarray,
    value_query_vector: Union[List[int], List[float]],
    vector_is_dependent: bool,
) -> pd.DataFrame:
    original_dataset_column_count = dataset.shape[1]
    num_cell_lines_used_in_calc = count_num_non_nan_per_row(dataset.transpose())
    assert original_dataset_column_count == len(num_cell_lines_used_in_calc)

    # calculate lin associations
    df = lin_associations_wrapper(dataset, value_query_vector, vector_is_dependent)

    # rename Index to make it clear it's a column index from the input matrix
    df.rename(columns={"Index": "matrix_col_index"}, inplace=True)

    # add a numCellLines column
    df["numCellLines"] = num_cell_lines_used_in_calc[df["matrix_col_index"]]

    return df


def run_pearson_correlations(
    callbacks: CustomAnalysisCallbacks,
    value_query_vector: Union[List[int], List[float]],
    features_df: FeaturesExtDataFrame,
    features_per_batch: int,
) -> pd.DataFrame:

    assert np.isnan(value_query_vector).sum() == 0

    callbacks.update_message("Running Pearson correlation...")

    vector_for_pearson = np.asarray([value_query_vector], dtype=float).transpose()

    def process_batch(batch):
        dataset = callbacks.get_dataset_df(batch)
        batch_result_df = run_pearson(vector_for_pearson, dataset)
        batch_result_df.index = batch
        return batch_result_df

    results_df = _process_features_in_batches(
        features_df,
        features_per_batch,
        _make_progress_callback(callbacks, "Running Pearson correlation..."),
        process_batch,
    )

    results_df = results_df[["Cor", "PValue", "numCellLines"]]

    assert isinstance(results_df, pd.DataFrame)  # for pyright
    sorted_df = _post_process_results(results_df, features_df, "Cor")

    return sorted_df


def run_linear_model_fits(
    callbacks: CustomAnalysisCallbacks,
    value_query_vector: Union[List[int], List[float]],
    features_df: FeaturesExtDataFrame,
    vector_is_dependent: bool,
    features_per_batch: int,
):
    # only supporting AnalysisType.two_class
    assert vector_is_dependent is not None

    update_message = callbacks.update_message

    update_message("Running two class comparison...")

    def process_batch(batch):
        dataset = callbacks.get_dataset_df(batch)

        batch_result_df = _compute_lm_associations(
            dataset, value_query_vector, vector_is_dependent
        )

        # map matrix column index back to feature index from features_df
        batch_indices = pd.Series(batch)
        batch_result_df.index = batch_indices.iloc[
            batch_result_df["matrix_col_index"]
        ].values

        return batch_result_df.drop(columns=["matrix_col_index"])

    results_df = _process_features_in_batches(
        features_df,
        features_per_batch,
        _make_progress_callback(callbacks, "Running linear model..."),
        process_batch,
    )

    # rename columns
    results_df = results_df.rename(
        columns={
            "PosteriorMean": "EffectSize",
            "p.val": "PValue",
            "qvalue": "QValue",
            "slice_id": "vectorId",
        }
    )

    # drop all columns except these
    results_df = results_df[["EffectSize", "PValue", "numCellLines"]]

    assert isinstance(results_df, pd.DataFrame)  # for pyright
    sorted_df = _post_process_results(results_df, features_df, "EffectSize")

    if len(results_df) == 0:
        # specific error to report back to the user
        raise UserError("Error: Running this analysis returned no results")

    return sorted_df


def write_custom_analysis_table(df, result_task_dir, effect_size_column):
    schema = pa.DataFrameSchema(
        {
            "label": pa.Column(str, nullable=False),
            "vectorId": pa.Column(str, nullable=False),
            "numCellLines": pa.Column(int, nullable=False),
            effect_size_column: pa.Column(float, nullable=True),
            "QValue": pa.Column(float, nullable=True),
            "PValue": pa.Column(float, nullable=True),
        }
    )

    df = schema.validate(df)

    df_dict = df.replace({np.nan: None}).to_dict(orient="records")

    # Assemble result
    data_json_file_path = os.path.join(result_task_dir, "results.json")
    with open(data_json_file_path, "wt") as fd:
        fd.write(json.dumps(df_dict))
    return data_json_file_path


def _process_features_in_batches(
    features_df: FeaturesExtDataFrame,
    features_per_batch: int,
    progress_callback: Callable[[float], None],
    process_batch: Callable[[List[int]], pd.DataFrame],
):
    batches = []
    for batch_start in range(0, len(features_df), features_per_batch):
        batch_end = min(batch_start + features_per_batch, len(features_df))
        batches.append(features_df.index[batch_start:batch_end])

    results = []
    for i, batch in enumerate(batches):
        progress_callback(i / len(batches))

        batch_result_df = process_batch(batch)

        # the index of each row should match up with the indices in batch. (They might be a subset if process_batch does not return a row for each feature, but there should never be any extra)
        assert set(batch_result_df.index).issubset(batch)

        results.append(batch_result_df)

    # combine the tables from each batch.
    results_df = pd.concat(results)
    return results_df


def _make_progress_callback(callbacks: CustomAnalysisCallbacks, message: str):
    def progress_callback(fraction_complete):
        # assuming 10% of time is before computing correlations
        # and assume 10% of time is packaging results up
        if fraction_complete > 1:
            log.warning(
                "fraction_complete should be between 0 and 1 but was %f",
                fraction_complete,
            )
        callbacks.update_message(
            message, percent_complete=((fraction_complete * 0.8 + 0.1) * 100),
        )

    return progress_callback


def _post_process_results(
    results_df: pd.DataFrame, features_df: FeaturesExtDataFrame, effect_size_column: str
) -> pd.DataFrame:
    # update QValue and sort by effect size

    # now that we have all the results, correct the p-values
    q_vals = np.full(len(results_df), np.nan)
    p_vals = results_df["PValue"]
    q_vals_mask = np.isfinite(p_vals)
    q_vals[q_vals_mask] = stats.false_discovery_control(p_vals[q_vals_mask])
    results_df["QValue"] = q_vals

    # join in the feature metadata
    full_df = results_df.join(features_df)
    full_df = full_df.rename(columns={"slice_id": "vectorId"})

    # sort by descending absolute
    return full_df.sort_values(by="cor", key=abs, ascending=False)


def _make_result_task_directory(result_dir, task_id):
    result_task_dir = os.path.join(result_dir, task_id)
    os.makedirs(result_task_dir)
    return result_task_dir


def run_custom_analysis(
    task_id: str,
    analysis_type: str,
    depmap_model_ids: List[str],
    value_query_vector: Union[List[int], List[float]],
    features_df: FeaturesExtDataFrame,
    feature_type: Optional[str],
    vector_is_dependent: Optional[bool],
    parameters: Dict,
    result_dir: str,
    use_feature_ids: bool,
    callbacks: CustomAnalysisCallbacks,
    features_per_batch: int,
):
    """
    Notes:
        - lm and pearson will both run with only 2 points. pearson will just return cor 1, and p val and q val NaN
        - if there is only 1 point (e.g. due to NaNs), the code will leave out the entity. lmstats and pearson each individually drop it before the merge
    """
    update_message = callbacks.update_message

    update_message("Loading...")
    assert isinstance(features_df, pd.DataFrame)

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
        df = run_pearson_correlations(
            callbacks, value_query_vector, features_df, features_per_batch,
        )
        effect_size_column = "Cor"
    else:
        assert vector_is_dependent is not None
        df = run_linear_model_fits(
            callbacks,
            value_query_vector,
            features_df,
            vector_is_dependent,
            features_per_batch,
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
        color_slice_id = callbacks.create_cell_line_group(in_group, use_feature_ids)
    else:
        color_slice_id = None

    filter_slice_id = callbacks.create_cell_line_group(
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


def run_pearson(vector, matrix_subsetted):
    (pearson_cor, p_vals, values_used_in_calc,) = fast_cor_with_p_values_with_missing(
        vector, matrix_subsetted
    )
    assert pearson_cor.shape[0] == 1
    assert p_vals.shape[0] == 1
    assert values_used_in_calc.shape[0] == 1

    pearson_cor = pearson_cor[0]
    p_vals = p_vals[0]
    values_used_in_calc = values_used_in_calc[0]

    return pd.DataFrame(
        {"Cor": pearson_cor, "PValue": p_vals, "numCellLines": values_used_in_calc}
    )


def fast_cor_with_p_values_with_missing(x, y):
    # preallocate storage for the result
    result = np.zeros(shape=(x.shape[1], y.shape[1]))
    p_vals = np.zeros(shape=(x.shape[1], y.shape[1]))
    num_used_in_calc = np.zeros(shape=(x.shape[1], y.shape[1]), dtype=int)

    x_groups = group_cols_with_same_mask(x)
    y_groups = group_cols_with_same_mask(y)

    counter = 0

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
            p = _calc_cor_p_values(n, c)
            p_vals[np.ix_(x_columns, y_columns)] = p

            num_used_in_calc[np.ix_(x_columns, y_columns)] = len(x_without_holes)

    return result, p_vals, num_used_in_calc


def _calc_cor_p_values(n, c):
    # n is the number of pairs of values used to compute the correlation
    # c is the pearson correlation for which we want the p-value

    dist = stats.beta(n / 2 - 1, n / 2 - 1, loc=-1, scale=2)
    p = 2 * dist.cdf(-abs(c))
    return p


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
    result = np.matmul(xv.transpose(), yv) / np.sqrt(np.outer(xvss, yvss))
    return np.maximum(np.minimum(result, 1.0), -1.0)
