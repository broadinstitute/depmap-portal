import math
import unittest
from typing import List
from unittest.mock import MagicMock
import os
import numpy as np

from breadbox.depmap_compute_embed.analysis_tasks_interface import (
    run_lin_associations_on_feature_subset,
    FeaturesExtDataFrame,
    CustomAnalysisCallbacks,
)
import pandas as pd
import random


def test_run_lin_associations_on_feature_subset():
    in_group_size = 20
    out_group_size = 300
    features_path = (
        "tests/compute/test_run_lin_associations_on_feature_subset/features.csv"
    )
    dataset_path = (
        "tests/compute/test_run_lin_associations_on_feature_subset/dataset.csv"
    )
    value_query_vector_path = "tests/compute/test_run_lin_associations_on_feature_subset/value_query_vector.csv"
    parent_dir = os.path.dirname(features_path)
    if not os.path.exists(parent_dir):
        os.makedirs(parent_dir)
        membership = ([1] * in_group_size) + ([0] * out_group_size)
        random.shuffle(membership)
        membership_series = pd.Series(membership)
        pd.DataFrame({"membership": membership_series}).to_csv(
            value_query_vector_path, index=False
        )

        # these test data files are checked into the repo, to ensure deterministic runs of tests.
        # but I also wanted to put the code used to generate them here so there'd be some record of how
        # they were generated in case we ever want to change them/make similar new ones. This code
        # is expected to not actually run as part of the test.
        print("Regenerating reference files")
        n_features = 50
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
                    np.random.normal(
                        loc=0, scale=1.0, size=in_group_size + out_group_size
                    ),
                )
            else:
                feature_values = np.random.normal(
                    loc=-1, scale=2.0, size=in_group_size + out_group_size
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

    # read the reference files
    features_df = FeaturesExtDataFrame(pd.read_csv(features_path, index_col=0))
    dataset_df = pd.read_csv(dataset_path)
    value_query_vector = list(pd.read_csv(value_query_vector_path).iloc[:, 0])

    def mock_get_dataset_df(feature_matrix_indices: List[int]):
        values = dataset_df.iloc[:, feature_matrix_indices].values
        assert isinstance(values, np.ndarray)
        return values

    callbacks = unittest.mock.create_autospec(CustomAnalysisCallbacks)
    callbacks.get_dataset_df.side_effect = mock_get_dataset_df

    result_df = run_lin_associations_on_feature_subset(
        features_df,
        callbacks,
        value_query_vector=value_query_vector,
        vector_is_dependent=False,
    )

    # only one feature should be very close to having a difference of -5 between the two groups
    strong_diff_rows = result_df[
        abs(result_df["PosteriorMean"] - (-5)) < 0.5
    ].to_records(index=False)
    assert len(strong_diff_rows) == 1
    strong_diff_row = strong_diff_rows[0]
    # and make sure that's feature 10
    assert strong_diff_row["given_id"] == "feature_10"
