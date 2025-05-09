import pandas as pd
import pytest
from unittest.mock import MagicMock

from breadbox_client.models import (
    FeatureResponse,
    FeatureResponseValues,
)
from depmap.breadbox_shim import breadbox_shim
from depmap.partials.matrix.models import CellLineSeries


mock_breadbox_feature_data = [
    FeatureResponse(
        feature_id="FEATURE1-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
        dataset_id="DATASET1-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
        values=FeatureResponseValues.from_dict(
            {"ACH-00001": 0.1, "ACH-00002": 0.2, "ACH-00003": 0.3,}
        ),
        label="feature1",
        units="inches",
        dataset_label="dataset1",
    ),
    FeatureResponse(
        feature_id="FEATURE2-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
        dataset_id="DATASET2-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
        values=FeatureResponseValues.from_dict(
            {"ACH-00002": 2, "ACH-00003": 3, "ACH-00004": 4,}
        ),
        label="feature2",
        units="feet",
        dataset_label="dataset2",
    ),
]

mock_breadbox_slice_ids = [
    "breadbox/DATASET1-XXXX-XXXX-XXXX-XXXXXXXXXXXX/FEATURE1-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
    "breadbox/DATASET2-XXXX-XXXX-XXXX-XXXXXXXXXXXX/FEATURE2-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
]


def test_get_feature_data_slice(mock_breadbox_client):
    # Mock the breadbox client response
    mock_breadbox_client.get_feature_data = MagicMock(
        return_value=[mock_breadbox_feature_data[0]]
    )

    # Test that the feature IDs are correctly parsed from the longer slice IDs
    expected_parsed_feature = "FEATURE1-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
    expected_parsed_dataset = "DATASET1-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
    result_series = breadbox_shim.get_feature_data_slice(mock_breadbox_slice_ids[0])
    mock_breadbox_client.get_feature_data.assert_called_with(
        dataset_ids=[expected_parsed_dataset], feature_ids=[expected_parsed_feature],
    )
    assert result_series.name == mock_breadbox_feature_data[0].label
    assert result_series.to_dict() == mock_breadbox_feature_data[0].values.to_dict()

    # Test that a 400 response is returned when an invalid slice ID is given
    invalid_feature_slice_id = "breadbox/dataset-id-without-feature-id"
    with pytest.raises(ValueError) as invalid_arguments_exception:
        breadbox_shim.get_feature_data_slice(invalid_feature_slice_id)


def test_get_features_calculated_value_lists(mock_breadbox_client):
    # Mock the breadbox client response
    mock_breadbox_client.get_feature_data = MagicMock(
        return_value=mock_breadbox_feature_data
    )

    # Validate that the values are parsed out correctly
    expected_feature_values = [
        CellLineSeries(
            pd.Series(
                {"ACH-00001": 0.1, "ACH-00002": 0.2, "ACH-00003": 0.3,},
                name="breadbox/DATASET1-XXXX-XXXX-XXXX-XXXXXXXXXXXX/FEATURE1-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
            )
        ),
        CellLineSeries(
            pd.Series(
                {"ACH-00002": 2, "ACH-00003": 3, "ACH-00004": 4,},
                name="breadbox/DATASET2-XXXX-XXXX-XXXX-XXXXXXXXXXXX/FEATURE2-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
            )
        ),
    ]
    expected_axis_labels = ["feature1 inches<br>dataset1", "feature2 feet<br>dataset2"]
    expected_feature_labels = ["feature1", "feature2"]
    expected_slice_ids = mock_breadbox_slice_ids
    (
        actual_feature_values,
        actual_axis_labels,
        actual_feature_labels,
        actual_slice_ids,
    ) = breadbox_shim.get_features_calculated_value_lists(mock_breadbox_slice_ids)

    assert len(actual_feature_values) == len(expected_feature_values)
    for i in range(len(expected_feature_values)):
        pd.testing.assert_series_equal(
            actual_feature_values[i], expected_feature_values[i]
        )
    assert actual_axis_labels == expected_axis_labels
    assert actual_feature_labels == expected_feature_labels
    assert actual_slice_ids == expected_slice_ids
