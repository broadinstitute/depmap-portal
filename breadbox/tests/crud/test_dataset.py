import numpy as np

from breadbox.db.session import SessionWithUser
from breadbox.crud.dataset import (
    get_dataset,
    get_dataset_feature_by_given_id,
)

from tests import factories


def test_get_dataset(minimal_db, settings):
    """Test that datasets can be retrieved by either id or given id"""
    given_id = "some_id"
    matrix_dataset_with_given_id = factories.matrix_dataset(
        minimal_db, settings, given_id=given_id
    )
    assert get_dataset(minimal_db, minimal_db.user, given_id) is not None
    assert (
        get_dataset(minimal_db, minimal_db.user, matrix_dataset_with_given_id.id)
        is not None
    )

    matrix_dataset_without_given_id = factories.matrix_dataset(
        minimal_db, settings, given_id=None,
    )
    assert (
        get_dataset(minimal_db, minimal_db.user, matrix_dataset_without_given_id.id)
        is not None
    )

    # Lastly, test that None is returned when the dataset doesn't exist
    assert get_dataset(minimal_db, minimal_db.user, "foo") is None


def test_get_dataset_feature_by_given_id(minimal_db: SessionWithUser, settings):
    """
    Test that this works regardless of whether dataset id or given id are passed in.
    """
    example_matrix_values = factories.matrix_csv_data_file_with_values(
        feature_ids=["featureID1", "featureID2", "featureID3"],
        sample_ids=["sampleID1", "sampleID2", "sampleID3"],
        values=np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]]),
    )
    dataset_given_id = "dataset_123"
    matrix_dataset = factories.matrix_dataset(
        minimal_db,
        settings,
        feature_type=None,
        data_file=example_matrix_values,
        given_id=dataset_given_id,
    )

    # Pass in the dataset ID
    feature1 = get_dataset_feature_by_given_id(
        minimal_db, matrix_dataset.id, "featureID1"
    )
    assert feature1.given_id == "featureID1"
    assert feature1.dataset_id == matrix_dataset.id
    feature2 = get_dataset_feature_by_given_id(
        minimal_db, matrix_dataset.id, "featureID2"
    )
    assert feature2.given_id == "featureID2"
    assert feature2.dataset_id == matrix_dataset.id

    # Pass in the dataset given ID
    feature1 = get_dataset_feature_by_given_id(
        minimal_db, dataset_given_id, "featureID1"
    )
    assert feature1.given_id == "featureID1"
    assert feature1.dataset_id == matrix_dataset.id
    feature2 = get_dataset_feature_by_given_id(
        minimal_db, dataset_given_id, "featureID2"
    )
    assert feature2.given_id == "featureID2"
    assert feature2.dataset_id == matrix_dataset.id
