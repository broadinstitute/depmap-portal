import numpy as np
import pandas as pd

from breadbox.db.session import SessionWithUser
from breadbox.crud.dataset import (
    get_dataset,
    get_dataset_feature_by_given_id,
    get_tabular_dataset_index_given_ids,
    get_datasets,
    get_unique_dimension_ids_from_datasets,
)
from breadbox.models.dataset import AnnotationType
from breadbox.schemas.dataset import ColumnMetadata

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


def test_get_tabular_dataset_index_given_ids(minimal_db, settings):
    """
    Test that this function works for 
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
                "label": ["featureLabel1", "featureLabel2", "featureLabel3"],
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

    non_metadata_result = get_tabular_dataset_index_given_ids(
        minimal_db, tabular_dataset
    )
    assert non_metadata_result == ["1", "2", "3", "4"]

    metadata_result = get_tabular_dataset_index_given_ids(
        minimal_db, dimension_type.dataset
    )
    assert metadata_result == ["1", "2", "5"]


def test_get_datasets_by_dimension_types(minimal_db, settings):
    """
    Test that this function works for tabular datasets and matrix datasets filtering by dimension type
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
                "label": ["featureLabel1", "featureLabel2", "featureLabel3"],
            }
        ),
    )
    # Define tabular datasets
    tabular_dataset_with_feature_type = factories.tabular_dataset(
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
    tabular_dataset_with_sample_type = factories.tabular_dataset(
        minimal_db,
        settings,
        data_df=pd.DataFrame(
            {
                "depmap_id": ["sampleID1", "sampleID2", "sampleID3", "sampleID4"],
                "SomeOtherColumn": ["a", "b", "c", "d"],
            }
        ),
        index_type_name="depmap_model",
        columns_metadata={
            "depmap_id": ColumnMetadata(col_type=AnnotationType.text),
            "SomeOtherColumn": ColumnMetadata(col_type=AnnotationType.text),
        },
    )
    # Example matrix values with IDs corresponding to above feature type
    example_matrix_values = factories.matrix_csv_data_file_with_values(
        feature_ids=["1", "2", "3"],
        sample_ids=["sampleID1", "sampleID2", "sampleID3"],
        values=np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]]),
    )
    # Example matrix with no feature type
    matrix_dataset_1 = factories.matrix_dataset(
        minimal_db, settings, feature_type=None, data_file=example_matrix_values,
    )

    # Just copy the matrix values file without needing to reset pointer
    example_matrix_values = factories.matrix_csv_data_file_with_values(
        feature_ids=["1", "2", "3"],
        sample_ids=["sampleID1", "sampleID2", "sampleID3"],
        values=np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]]),
    )
    # Example matrix with feature type
    matrix_dataset_2 = factories.matrix_dataset(
        minimal_db,
        settings,
        feature_type="some_feature_type",
        data_file=example_matrix_values,
    )
    # Test that tabular and matrix datasets returned for filtering by feature type
    datasets_with_feature_type = get_datasets(
        minimal_db, minimal_db.user, feature_type="some_feature_type"
    )
    assert len(datasets_with_feature_type) == 3
    for dataset in datasets_with_feature_type:
        assert dataset.id in [
            dimension_type.dataset_id,
            matrix_dataset_2.id,
            tabular_dataset_with_feature_type.id,
        ]

    # Test that tabular and matrix datasets returned for filtering by sample type
    datasets_with_sample_type = get_datasets(
        minimal_db, minimal_db.user, sample_type="depmap_model"
    )

    assert len(datasets_with_sample_type) == 3
    for dataset in datasets_with_sample_type:
        assert dataset.id in [
            matrix_dataset_1.id,
            matrix_dataset_2.id,
            tabular_dataset_with_sample_type.id,
        ]

    # test filter both feature and sample type
    datasets_with_sample_and_feature_type = get_datasets(
        minimal_db,
        minimal_db.user,
        feature_type="some_feature_type",
        sample_type="depmap_model",
    )
    assert len(datasets_with_sample_and_feature_type) == 1
    assert datasets_with_sample_and_feature_type[0].id == matrix_dataset_2.id

    # test that when filtering a dimension type by the wrong axis, the datasets won't get returned
    datasets_with_feature_type_as_sample_type = get_datasets(
        minimal_db, minimal_db.user, sample_type="some_feature_type"
    )
    assert len(datasets_with_feature_type_as_sample_type) == 0


def test_get_datasets_by_data_type(minimal_db, settings):
    factories.data_type(minimal_db, "Data Type 1")
    factories.data_type(minimal_db, "Data Type 2")
    tabular_dataset = factories.tabular_dataset(
        minimal_db,
        settings,
        data_df=pd.DataFrame(
            {
                "depmap_id": ["sampleID1", "sampleID2", "sampleID3", "sampleID4"],
                "SomeOtherColumn": ["a", "b", "c", "d"],
            }
        ),
        index_type_name="depmap_model",
        columns_metadata={
            "depmap_id": ColumnMetadata(col_type=AnnotationType.text),
            "SomeOtherColumn": ColumnMetadata(col_type=AnnotationType.text),
        },
        data_type_="Data Type 1",
    )
    # Example matrix values with IDs corresponding to above feature type
    example_matrix_values = factories.matrix_csv_data_file_with_values(
        feature_ids=["1", "2", "3"],
        sample_ids=["sampleID1", "sampleID2", "sampleID3"],
        values=np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]]),
    )
    # Example matrix with no feature type
    matrix_dataset = factories.matrix_dataset(
        minimal_db,
        settings,
        feature_type=None,
        data_file=example_matrix_values,
        data_type="Data Type 2",
    )
    datasets_with_data_type_1 = get_datasets(
        minimal_db, minimal_db.user, data_type="Data Type 1"
    )
    assert len(datasets_with_data_type_1) == 1
    assert datasets_with_data_type_1[0].id == tabular_dataset.id

    datasets_with_data_type_2 = get_datasets(
        minimal_db, minimal_db.user, data_type="Data Type 2"
    )
    assert len(datasets_with_data_type_2) == 1
    assert datasets_with_data_type_2[0].id == matrix_dataset.id


def test_get_unique_dimension_ids_from_datasets(minimal_db, settings):
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
                "ID": ["F1", "F2", "F5"],
                "label": ["featureLabel1", "featureLabel2", "featureLabel3"],
            }
        ),
    )
    # Define tabular datasets
    tabular_dataset_with_feature_type = factories.tabular_dataset(
        minimal_db,
        settings,
        data_df=pd.DataFrame(
            {"ID": ["F1", "F2", "F3", "F4"], "SomeOtherColumn": ["a", "b", "c", "d"]}
        ),
        index_type_name="some_feature_type",
        columns_metadata={
            "ID": ColumnMetadata(col_type=AnnotationType.text),
            "SomeOtherColumn": ColumnMetadata(col_type=AnnotationType.text),
        },
    )

    # Example matrix values with IDs corresponding to above feature type
    example_matrix_values = factories.matrix_csv_data_file_with_values(
        feature_ids=["F1", "F2", "F3"],
        sample_ids=["sampleID1", "sampleID2", "sampleID3"],
        values=np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]]),
    )
    # Example matrix with feature type
    matrix_dataset_with_feature_type = factories.matrix_dataset(
        minimal_db,
        settings,
        feature_type="some_feature_type",
        data_file=example_matrix_values,
    )
    dimensions_set = get_unique_dimension_ids_from_datasets(
        minimal_db,
        [matrix_dataset_with_feature_type.id, tabular_dataset_with_feature_type.id],
        dimension_type,
    )

    assert dimensions_set == set(["F1", "F2", "F3", "F4"])
