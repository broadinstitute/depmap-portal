import numpy as np
import pandas as pd
import pytest

from breadbox.db.session import SessionWithUser
from breadbox.service.metadata import (
    get_tabular_dataset_labels_by_id,
    get_dataset_feature_by_label,
)
from breadbox.models.dataset import AnnotationType
from breadbox.schemas.custom_http_exception import (
    DatasetNotFoundError,
    FeatureNotFoundError,
)
from breadbox.schemas.dataset import ColumnMetadata
from tests import factories


def test_get_tabular_dataset_labels_by_id(minimal_db: SessionWithUser, settings):
    """
    Test that this function loads labels correctly for 
    - tabular datasets that are metadata and
    - tabular datasets that are not metadata
    """
    # Define metadata
    dimension_type = factories.add_dimension_type(
        minimal_db,
        settings,
        user=settings.admin_users[0],
        name="some_feature_type",
        display_name="Feature With Metadata",
        id_column="ID",
        annotation_type_mapping={
            "ID": AnnotationType.text,
            "label": AnnotationType.text,
        },
        axis="feature",
        metadata_df=pd.DataFrame(
            {
                "ID": ["1", "2", "5"],
                "label": ["featureLabel1", "featureLabel2", "featureLabel5"],
            }
        ),
    )
    tabular_dataset = factories.tabular_dataset(
        minimal_db,
        settings,
        data_df=pd.DataFrame(
            {"ID": ["1", "2", "3", "4"], "SomeOtherColumn": ["a", "b", "c", "d"]}
        ),
        index_type_name="some_feature_type",
        columns_metadata={
            "ID": ColumnMetadata(col_type=AnnotationType.text),
            "SomeOtherColumn": ColumnMetadata(col_type=AnnotationType.text),
        },
    )

    # This should only include the labels that overlap between the dataset and its metadata
    non_metadata_result = get_tabular_dataset_labels_by_id(minimal_db, tabular_dataset)
    assert non_metadata_result == {"1": "featureLabel1", "2": "featureLabel2"}

    metadata_result = get_tabular_dataset_labels_by_id(
        minimal_db, dimension_type.dataset
    )
    assert metadata_result == {
        "1": "featureLabel1",
        "2": "featureLabel2",
        "5": "featureLabel5",
    }


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
    with pytest.raises(DatasetNotFoundError):
        get_dataset_feature_by_label(
            minimal_db,
            dataset_id="Undefined-dataset",
            feature_label="someFeatureLabel",
        )

    # When the featureLabel does not exist within the dataset, a clear error should be raised
    with pytest.raises(FeatureNotFoundError):
        get_dataset_feature_by_label(
            minimal_db,
            dataset_id=dataset_with_generic_features.id,
            feature_label="Undefined_Feature_Label",
        )
