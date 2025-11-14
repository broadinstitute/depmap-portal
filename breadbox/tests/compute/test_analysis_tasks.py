from breadbox.compute.analysis_tasks import _filter_out_models_not_in_search_dataset
import pandas as pd
from pandas.testing import assert_frame_equal


def test_filter_out_models_not_in_search_dataset():
    feature_df = pd.DataFrame(
        {"A": [1, 3, 4], "B": [21, 23, 24]}, index=["ACH-001", "ACH-003", "ACH-004"]
    )
    model_query_vector = ["ACH-001", "ACH-002", "ACH-003"]
    value_query_vector = [1, 2, 3]

    (
        final_model_query_vector,
        final_value_query_vector,
        final_feature_df,
    ) = _filter_out_models_not_in_search_dataset(
        feature_df, model_query_vector, value_query_vector
    )

    assert final_model_query_vector == ["ACH-001", "ACH-003"]
    assert final_value_query_vector == [1, 3]
    expected_df = pd.DataFrame(
        {"A": [1, 3], "B": [21, 23]}, index=["ACH-001", "ACH-003"]
    )
    assert_frame_equal(final_feature_df, expected_df)
