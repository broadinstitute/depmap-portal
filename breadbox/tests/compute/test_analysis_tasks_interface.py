import unittest.mock
from typing import List
import os
import numpy as np

from breadbox.depmap_compute_embed.analysis_tasks_interface import (
    FeaturesExtDataFrame,
    CustomAnalysisCallbacks,
    _run_pearson,
    _run_lm,
)
import pandas as pd
import random

in_group_size = 20
out_group_size = 300
n_features = 50

features_path = "tests/compute/test_run_lin_associations_on_feature_subset/features.csv"
dataset_path = "tests/compute/test_run_lin_associations_on_feature_subset/dataset.csv"
query_vector_path = (
    "tests/compute/test_run_lin_associations_on_feature_subset/value_query_vector.csv"
)


def ensure_datafiles_exist():
    # these test data files are checked into the repo, to ensure deterministic runs of tests.
    # but I also wanted to put the code used to generate them here so there would be some record of how
    # they were generated in case we ever want to change them/make similar new ones. This code
    # is expected to not actually run as part of the test, as the parent dir should exist.

    parent_dir = os.path.dirname(features_path)
    if os.path.exists(parent_dir):
        return

    os.makedirs(parent_dir)
    membership = ([1] * in_group_size) + ([0] * out_group_size)
    random.shuffle(membership)
    membership_series = pd.Series(membership)
    pd.DataFrame({"membership": membership_series}).to_csv(
        query_vector_path, index=False
    )

    print("Regenerating reference files")
    feature_given_ids = []
    feature_columns = {}
    for i in range(n_features):
        feature_given_id = f"feature_{i}"
        # most features are random noise with a few exceptions injected in the middle
        if i == 10:
            # add an example of a strong difference between in group and out group
            feature_values = np.where(
                membership_series == 1,
                np.random.normal(
                    loc=-5, scale=1.0, size=in_group_size + out_group_size
                ),
                np.random.normal(loc=0, scale=1.0, size=in_group_size + out_group_size),
            )
        else:
            feature_values = np.random.normal(
                loc=-1, scale=0.5, size=in_group_size + out_group_size
            )
        # add this column
        feature_columns[feature_given_id] = feature_values
        feature_given_ids.append(feature_given_id)

    pd.DataFrame(feature_columns).to_csv(dataset_path, index=False)
    # simulate the way that breadbox allows columns to be in dataset _but_ missing metadata. This should result
    # in these features being ignored in the analysis. (And properly lining up the labels for the features
    # is a frequent source of bugs so we definitely want to simulate that)
    feature_df = pd.DataFrame(
        {
            "given_id": feature_given_ids,
            "label": [x + " label" for x in feature_given_ids],
            "slice_id": ["slice/" + x for x in feature_given_ids],
        }
    )

    feature_df = feature_df[~feature_df.index.isin([3, 25])]
    feature_df.to_csv(features_path, index=True)


def test_run_lm_effect_size():
    ensure_datafiles_exist()

    # read the reference files
    features_df = FeaturesExtDataFrame(pd.read_csv(features_path, index_col=0))
    dataset_df = pd.read_csv(dataset_path)
    value_query_vector = list(pd.read_csv(query_vector_path).iloc[:, 0])

    callbacks = MockCustomAnalysisCallbacks(dataset_df.values)

    result_df = _run_lm(
        callbacks,
        value_query_vector=value_query_vector,
        features_df=features_df,
        vector_is_dependent=False,
        features_per_batch=1000,  # run in one batch
    )

    # only one feature should be very close to having a difference of -5 between the two groups
    strong_diff_rows = result_df[abs(result_df["EffectSize"] - (-5)) < 0.5].to_records(
        index=False
    )
    assert len(strong_diff_rows) == 1
    strong_diff_row = strong_diff_rows[0]
    # and make sure that's feature 10
    assert strong_diff_row["label"] == "feature_10 label"

    # all other rows should have a diff close to zero
    no_diff_rows = result_df[abs(result_df["EffectSize"] - (0)) < 0.5].to_records(
        index=False
    )
    assert len(no_diff_rows) == (
        n_features - 1 - 2
    )  # remove the two features which are missing metadata and the one row with a strong effect size


class MockCustomAnalysisCallbacks(CustomAnalysisCallbacks):
    def __init__(self, data_matrix: np.ndarray):
        self.data_matrix = data_matrix

    def create_cell_line_group(
        self, model_ids: List[str], use_feature_ids: bool
    ) -> str:
        pass

    def get_dataset_df(self, feature_matrix_indices: List[int]) -> np.ndarray:
        return self.data_matrix[:, feature_matrix_indices]

    def update_message(
        self, message=None, start_time=None, max_time: int = 45, percent_complete=None
    ):
        pass


def test_run_lin_associations_consistency():
    # make sure that we get the same results whether run on a single batch or multiple batches
    ensure_datafiles_exist()

    dataset_df = pd.read_csv(dataset_path)
    features_df = FeaturesExtDataFrame(pd.read_csv(features_path, index_col=0))
    value_query_vector = list(pd.read_csv(query_vector_path).iloc[:, 0])

    vector_is_dependent = True
    callbacks = MockCustomAnalysisCallbacks(dataset_df.values)

    one_batch_df = _run_lm(
        callbacks,
        value_query_vector,
        features_df,
        vector_is_dependent,
        features_per_batch=1000,
    )

    many_batches_df = _run_lm(
        callbacks,
        value_query_vector,
        features_df,
        vector_is_dependent,
        features_per_batch=2,
    )

    pd.testing.assert_frame_equal(one_batch_df, many_batches_df)


def test_run_pearson_consistency():
    # make sure that we get the same results whether run on a single batch or multiple batches
    ensure_datafiles_exist()

    # read the reference files
    features_df = FeaturesExtDataFrame(pd.read_csv(features_path, index_col=0))
    dataset_df = pd.read_csv(dataset_path)
    value_query_vector = list(pd.read_csv(query_vector_path).iloc[:, 0])

    vector_is_dependent = True
    callbacks = MockCustomAnalysisCallbacks(dataset_df.values)

    one_batch_df = _run_pearson(
        callbacks, value_query_vector, features_df, features_per_batch=1000,
    )

    many_batches_df = _run_pearson(
        callbacks, value_query_vector, features_df, features_per_batch=2,
    )

    pd.testing.assert_frame_equal(one_batch_df, many_batches_df)
