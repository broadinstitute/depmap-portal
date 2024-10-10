import numpy as np
import pandas as pd
import pytest

from breadbox.db.session import SessionWithUser
from breadbox.crud.dataset import (
    get_dataset_feature_by_label,
    get_dataset,
    get_dataset_feature_by_given_id,
    get_slice_data,
)
from breadbox.models.dataset import AnnotationType
from breadbox.schemas.custom_http_exception import ResourceNotFoundError

from depmap_compute.slice import SliceQuery

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


def test_get_dataset_feature_by_label(minimal_db: SessionWithUser, settings):

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
    feature = get_dataset_feature_by_label(
        minimal_db,
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
        display_name="Feature With Metadata",
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
    feature = get_dataset_feature_by_label(
        minimal_db, dataset_id=dataset_with_metadata.id, feature_label="featureLabel1",
    )
    assert feature.dataset_id == dataset_with_metadata.id
    assert feature.given_id == "featureID1"

    # When the dataset does not exist, a clear error should be raised
    with pytest.raises(ResourceNotFoundError):
        get_dataset_feature_by_label(
            minimal_db,
            dataset_id="Undefined-dataset",
            feature_label="someFeatureLabel",
        )

    # When the featureLabel does not exist within the dataset, a clear error should be raised
    with pytest.raises(ResourceNotFoundError):
        get_dataset_feature_by_label(
            minimal_db,
            dataset_id=dataset_with_generic_features.id,
            feature_label="Undefined_Feature_Label",
        )


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


def test_get_slice_data_with_matrix_dataset(minimal_db: SessionWithUser, settings):
    """
    Test that the get_slice_data function works with all matrix identifier types.
    """
    filestore_location = settings.filestore_location
    # Define label metadata for our features
    factories.add_dimension_type(
        minimal_db,
        settings,
        user=settings.admin_users[0],
        name="feature-with-metadata",
        display_name="Feature With Metadata",
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

    # Define label metadata for our samples
    factories.add_dimension_type(
        minimal_db,
        settings,
        user=settings.admin_users[0],
        name="sample-with-metadata",
        display_name="Sample With Metadata",
        id_column="ID",
        annotation_type_mapping={
            "ID": AnnotationType.text,
            "label": AnnotationType.text,
        },
        axis="sample",
        metadata_df=pd.DataFrame(
            {
                "ID": ["sampleID1", "sampleID2", "sampleID3"],
                "label": ["sampleLabel1", "sampleLabel2", "sampleLabel3"],
            }
        ),
    )

    # Define a matrix dataset
    example_matrix_values = factories.matrix_csv_data_file_with_values(
        feature_ids=["featureID1", "featureID2", "featureID3"],
        sample_ids=["sampleID1", "sampleID2", "sampleID3"],
        values=np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]]),
    )
    dataset_given_id = "dataset_123"
    dataset_with_metadata = factories.matrix_dataset(
        minimal_db,
        settings,
        feature_type="feature-with-metadata",
        sample_type="sample-with-metadata",
        data_file=example_matrix_values,
        given_id=dataset_given_id,
    )

    # Test queries by feature_id
    feature_id_query = SliceQuery(
        dataset_id=dataset_given_id,
        identifier="featureID2",
        identifier_type="feature_id",
    )
    result_series = get_slice_data(minimal_db, filestore_location, feature_id_query)
    assert result_series.index.tolist() == ["sampleID1", "sampleID2", "sampleID3"]
    assert result_series.values.tolist() == [2, 5, 8]

    # Test queries by feature_label
    feature_label_query = SliceQuery(
        dataset_id=dataset_given_id,
        identifier="featureLabel1",
        identifier_type="feature_label",
    )
    result_series = get_slice_data(minimal_db, filestore_location, feature_label_query)
    assert result_series.index.tolist() == ["sampleID1", "sampleID2", "sampleID3"]
    assert result_series.values.tolist() == [1, 4, 7]

    # Test queries by sample_id
    sample_id_query = SliceQuery(
        dataset_id=dataset_given_id, identifier="sampleID3", identifier_type="sample_id"
    )
    result_series = get_slice_data(minimal_db, filestore_location, sample_id_query)
    assert result_series.index.tolist() == ["featureID1", "featureID2", "featureID3"]
    assert result_series.values.tolist() == [7, 8, 9]

    # Test queries by sample_label
    sample_label_query = SliceQuery(
        dataset_id=dataset_given_id,
        identifier="sampleLabel2",
        identifier_type="sample_label",
    )
    result_series = get_slice_data(minimal_db, filestore_location, sample_label_query)
    assert result_series.index.tolist() == ["featureID1", "featureID2", "featureID3"]
    assert result_series.values.tolist() == [4, 5, 6]
    # TODO: debug this last test
