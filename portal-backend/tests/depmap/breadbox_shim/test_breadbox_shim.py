import pandas as pd
import pytest
from unittest.mock import MagicMock

from breadbox_client.models import (
    MatrixDatasetResponse,
    MatrixDatasetResponseDatasetMetadataType0,
    FeatureResponse,
    FeatureResponseValues,
    Group,
    ValueType,
)
from depmap.breadbox_shim import breadbox_shim
from depmap.partials.matrix.models import CellLineSeries
from depmap.vector_catalog.models import Node


mock_breadbox_datasets = [
    MatrixDatasetResponse(
        id="DATASET1-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
        name="Dataset 1",
        units="AUC",
        is_transient=False,
        group_id="00000000-0000-0000-0000-000000000000",
        group=Group(id="00000000-0000-0000-0000-000000000000", name="Public"),
        feature_type_name="compound",
        sample_type_name="depmap_model",
        data_type="user_upload",
        dataset_metadata=None,
        value_type=ValueType.CONTINUOUS,
        allowed_values=None,
    ),
    MatrixDatasetResponse(
        id="DATASET2-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
        name="Dataset 2",
        units="Gene Effect (Chronos)",
        is_transient=False,
        group_id="00000000-0000-0000-0000-000000000000",
        group=Group(id="00000000-0000-0000-0000-000000000000", name="Public"),
        feature_type_name="gene",
        sample_type_name="depmap_model",
        data_type="user_upload",
        dataset_metadata=MatrixDatasetResponseDatasetMetadataType0.from_dict(
            {"show_in_vector_catalog": True}
        ),
        value_type=ValueType.CATEGORICAL,
        allowed_values=None,
    ),
]

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

mock_breadbox_features = [
    {"id": "FEATURE3-XXXX-XXXX-XXXX-XXXXXXXXXXXX", "label": "feature3"},
    {"id": "FEATURE4-XXXX-XXXX-XXXX-XXXXXXXXXXXX", "label": "feature4"},
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


def test_get_vector_catalog_datasets(mock_breadbox_client):
    # Mock the breadbox client response
    mock_breadbox_client.get_datasets = MagicMock(return_value=mock_breadbox_datasets)

    vector_catalog_datasets = breadbox_shim._get_vector_catalog_datasets()

    assert len(vector_catalog_datasets) == 1
    assert vector_catalog_datasets[0].id == "DATASET2-XXXX-XXXX-XXXX-XXXXXXXXXXXX"


def test_get_vector_catalog_children_dataset_node(mock_breadbox_client):
    # Mock the breadbox client response
    mock_breadbox_client.get_dataset_features = MagicMock(
        return_value=mock_breadbox_features
    )

    dataset1_slice_id = "breadbox/DATASET1-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
    response = breadbox_shim.get_vector_catalog_children(dataset1_slice_id)

    expected_feature3_slice_id = "breadbox/DATASET1-XXXX-XXXX-XXXX-XXXXXXXXXXXX/FEATURE3-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
    expected_feature4_slice_id = "breadbox/DATASET1-XXXX-XXXX-XXXX-XXXXXXXXXXXX/FEATURE4-XXXX-XXXX-XXXX-XXXXXXXXXXXX"

    assert response is not None
    response_children = response.children
    assert len(response_children) == 2
    assert response_children[0].label == "feature3"
    assert response_children[0].id == expected_feature3_slice_id
    assert response_children[1].label == "feature4"
    assert response_children[1].id == expected_feature4_slice_id


def test_get_vector_catalog_children_feature_node():
    feature1_slice_id = "breadbox/DATASET1-XXXX-XXXX-XXXX-XXXXXXXXXXXX/FEATURE1-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
    actual_response = breadbox_shim.get_vector_catalog_children(feature1_slice_id)

    # Features should have no children, but should still return a response object
    assert actual_response is not None
    assert actual_response.children == []


def test_get_dataset_nodes(mock_breadbox_client):
    # Update our mocks to all be allowed in vector catalog:
    for dataset_mock in mock_breadbox_datasets:
        dataset_mock.dataset_metadata = MatrixDatasetResponseDatasetMetadataType0.from_dict(
            {"show_in_vector_catalog": True}
        )
    # Mock the response from breadbox
    mock_breadbox_client.get_datasets = MagicMock(return_value=mock_breadbox_datasets)

    # check that the shim returns all datasetes (both continuous and categorical)
    # when given the continuous_and_categorical catalog type
    actual_dataset_nodes = breadbox_shim.get_dataset_nodes("continuous_and_categorical")

    assert len(actual_dataset_nodes) == 2
    assert actual_dataset_nodes[0].id == "breadbox/DATASET1-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
    assert actual_dataset_nodes[1].id == "breadbox/DATASET2-XXXX-XXXX-XXXX-XXXXXXXXXXXX"

    # check that the shim returns a subset of the datasets
    # when given the categorical catalog type
    actual_dataset_nodes = breadbox_shim.get_dataset_nodes("categorical")

    assert len(actual_dataset_nodes) == 1
    assert actual_dataset_nodes[0].id == "breadbox/DATASET2-XXXX-XXXX-XXXX-XXXXXXXXXXXX"


def test_get_feature_nodes(mock_breadbox_client):
    mock_breadbox_client.get_dataset_features = MagicMock(
        return_value=mock_breadbox_features
    )

    # Check that the features returned by breadbox are parsed and formatted correctly
    feature_nodes: list[Node] = breadbox_shim._get_feature_nodes(
        "DATASET1-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
    )
    assert len(feature_nodes) == 2
    assert (
        feature_nodes[0].id
        == "breadbox/DATASET1-XXXX-XXXX-XXXX-XXXXXXXXXXXX/FEATURE3-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
    )
    assert feature_nodes[0].label == "feature3"
    assert (
        feature_nodes[1].id
        == "breadbox/DATASET1-XXXX-XXXX-XXXX-XXXXXXXXXXXX/FEATURE4-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
    )
    assert feature_nodes[1].label == "feature4"
