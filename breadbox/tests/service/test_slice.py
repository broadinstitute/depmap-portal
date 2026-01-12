import numpy as np
import pandas as pd

from breadbox.db.session import SessionWithUser
from breadbox.service.slice import get_slice_data
from breadbox.models.dataset import AnnotationType
from breadbox.schemas.dataset import ColumnMetadata

from breadbox.depmap_compute_embed.slice import SliceQuery

from tests import factories


def test_get_slice_data_with_matrix_dataset(minimal_db: SessionWithUser, settings):
    """
    Test that the get_slice_data function works with all matrix identifier types.
    Also test that it filters NA values correctly.
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
        values=np.array([[np.NAN, 2, 3], [4, np.NAN, 6], [7, 8, np.NAN]]),
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
    assert result_series.index.tolist() == ["sampleID1", "sampleID3"]
    assert result_series.values.tolist() == [2, 8]

    # Test queries by feature_label
    feature_label_query = SliceQuery(
        dataset_id=dataset_given_id,
        identifier="featureLabel1",
        identifier_type="feature_label",
    )
    result_series = get_slice_data(minimal_db, filestore_location, feature_label_query)
    assert result_series.index.tolist() == ["sampleID2", "sampleID3"]
    assert result_series.values.tolist() == [4, 7]

    # Test queries by sample_id
    sample_id_query = SliceQuery(
        dataset_id=dataset_given_id, identifier="sampleID3", identifier_type="sample_id"
    )
    result_series = get_slice_data(minimal_db, filestore_location, sample_id_query)
    assert result_series.index.tolist() == ["featureID1", "featureID2"]
    assert result_series.values.tolist() == [7, 8]

    # Test queries by sample_label
    sample_label_query = SliceQuery(
        dataset_id=dataset_given_id,
        identifier="sampleLabel2",
        identifier_type="sample_label",
    )
    result_series = get_slice_data(minimal_db, filestore_location, sample_label_query)
    assert result_series.index.tolist() == ["featureID1", "featureID3"]
    assert result_series.values.tolist() == [4, 6]


def test_get_slice_data_with_tabular_dataset(minimal_db: SessionWithUser, settings):
    """
    Test that the get_slice_data function works with tabular identifier types.
    """
    filestore_location = settings.filestore_location
    factories.add_dimension_type(
        minimal_db,
        settings,
        user=settings.admin_users[0],
        name="some-sample-type",
        axis="sample",
        id_column="ID",
    )

    dataset_given_id = "my-tabular-dataset"
    factories.tabular_dataset(
        minimal_db,
        settings,
        name="some-tabular-dataset",
        columns_metadata={
            "ID": ColumnMetadata(units=None, col_type=AnnotationType.text),
            "label": ColumnMetadata(units=None, col_type=AnnotationType.text),
            "count": ColumnMetadata(
                units="somethings", col_type=AnnotationType.continuous
            ),
        },
        data_df=pd.DataFrame(
            {
                "ID": ["sampleID1", "sampleID2", "sampleID3"],
                "label": ["sampleLabel1", "sampleLabel2", "sampleLabel3"],
                "count": [1, 2, 3],
            }
        ),
        index_type_name="some-sample-type",
        given_id=dataset_given_id,
    )

    # Test queries by column
    label_column_query = SliceQuery(
        dataset_id=dataset_given_id, identifier="label", identifier_type="column",
    )
    result_series = get_slice_data(minimal_db, filestore_location, label_column_query)
    assert result_series.index.tolist() == ["sampleID1", "sampleID2", "sampleID3"]
    assert result_series.values.tolist() == [
        "sampleLabel1",
        "sampleLabel2",
        "sampleLabel3",
    ]

    count_column_query = SliceQuery(
        dataset_id=dataset_given_id, identifier="count", identifier_type="column",
    )
    result_series = get_slice_data(minimal_db, filestore_location, count_column_query)
    assert result_series.index.tolist() == ["sampleID1", "sampleID2", "sampleID3"]
    assert result_series.values.tolist() == [1, 2, 3]
