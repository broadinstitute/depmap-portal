import numpy as np
import pandas as pd
import pytest

from breadbox.db.session import SessionWithUser
from breadbox.crud.dataset import get_dataset_feature, get_dataset
from breadbox.models.dataset import AnnotationType
from breadbox.schemas.custom_http_exception import ResourceNotFoundError

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


def test_get_dataset_feature(minimal_db: SessionWithUser, settings):

    # Test the case where there is no metadata (where labels are given_ids)
    example_matrix_values = factories.matrix_csv_data_file_with_values(
        feature_ids=["featureID1", "featureID2", "featureID3"],
        sample_ids=["sampleID1", "sampleID2", "sampleID3"],
        values=np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]]),
    )
    dataset_with_generic_features = factories.matrix_dataset(
        minimal_db, settings, feature_type=None, data_file=example_matrix_values
    )
    minimal_db.reset_user(settings.default_user)
    feature = get_dataset_feature(
        minimal_db,
        settings.default_user,
        dataset_id=dataset_with_generic_features.id,
        feature_label="featureID1",
    )
    assert feature.dataset_id == dataset_with_generic_features.id
    assert feature.given_id == "featureID1"

    # Test the case where metadata does exist
    minimal_db.reset_user(settings.admin_users[0])
    factories.add_dimension_type(
        minimal_db,
        settings,
        user=settings.admin_users[0],
        name="feature-with-metadata",
        id_column="ID",
        annotation_type_mapping={
            "ID": AnnotationType.text,
            "label": AnnotationType.text,
        },
        axis="feature",
        metadata_df=pd.DataFrame(
            {
                "ID": ["featureID1", "featureID2", "featureID3"],
                "label": ["featureLabel1", "featureLabel2", "featureLabel3"],
            }
        ),
    )
    example_matrix_values = factories.matrix_csv_data_file_with_values(
        feature_ids=["featureID1", "featureID2", "featureID3"],
        sample_ids=["sampleID1", "sampleID2", "sampleID3"],
        values=np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]]),
    )
    dataset_with_metadata = factories.matrix_dataset(
        minimal_db,
        settings,
        feature_type="feature-with-metadata",
        data_file=example_matrix_values,
    )

    # Query with the non-admin user
    minimal_db.reset_user(settings.default_user)
    feature = get_dataset_feature(
        minimal_db,
        settings.default_user,
        dataset_id=dataset_with_metadata.id,
        feature_label="featureLabel1",
    )
    assert feature.dataset_id == dataset_with_metadata.id
    assert feature.given_id == "featureID1"

    # When the dataset does not exist, a clear error should be raised
    with pytest.raises(ResourceNotFoundError):
        get_dataset_feature(
            minimal_db,
            settings.default_user,
            dataset_id="Undefined-dataset",
            feature_label="someFeatureLabel",
        )

    # When the featureLabel does not exist within the dataset, a clear error should be raised
    with pytest.raises(ResourceNotFoundError):
        get_dataset_feature(
            minimal_db,
            settings.default_user,
            dataset_id=dataset_with_generic_features.id,
            feature_label="Undefined_Feature_Label",
        )
