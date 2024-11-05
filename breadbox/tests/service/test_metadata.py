import pandas as pd

from breadbox.db.session import SessionWithUser
from breadbox.service.metadata import get_tabular_dataset_labels_by_id
from breadbox.models.dataset import AnnotationType
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
