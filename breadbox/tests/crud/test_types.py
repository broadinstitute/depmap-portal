import pandas as pd

from breadbox.db.session import SessionWithUser
from breadbox.service.dataset import add_dimension_type
from breadbox.schemas.types import AnnotationType
from breadbox.schemas.dataset import ColumnMetadata

from tests import factories


def test_add_dimension_type_metadata_dataset_field_populates(
    minimal_db: SessionWithUser, settings
):
    """
    This recreates a heisenbug that appeared when implementing global access control filtering. 
    SQLAlchemy does some internal memoisation to prevent it emitting a new SQL query every time 
    you access a relationship. The effect is that relationship fields (like dimension_type.dataset) 
    sometimes fail to update after a foreign key (like dimension_type.dataset_id) is updated. 
    This had been happening periodically with the update_dimension_type_metadata and add_dimension_type 
    functions but is fixed now.
    """
    # First, create a dimension type with a dataset.
    # Make sure the DimensionType.dataset field populates.
    dimension_type_with_metadata = add_dimension_type(
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
    assert dimension_type_with_metadata.dataset_id is not None
    assert dimension_type_with_metadata.dataset is not None

    # Second, create a dimension type with no dataset.
    # Reference the dataset later and make sure it populates
    dimension_type_with_later_added_metadata = add_dimension_type(
        minimal_db,
        settings,
        user=settings.admin_users[0],
        name="sample-with-metadata-added-later",
        display_name="Sample with Metadata Added Later",
        id_column="ID",
        annotation_type_mapping={
            "ID": AnnotationType.text,
            "label": AnnotationType.text,
        },
        axis="sample",
    )

    assert dimension_type_with_later_added_metadata.dataset_id == None
    assert dimension_type_with_later_added_metadata.dataset == None

    # Now add a dataset to the second dimension type
    tabular_dataset = factories.tabular_dataset(
        minimal_db,
        settings,
        columns_metadata={
            "ID": ColumnMetadata(units=None, col_type=AnnotationType.text),
            "label": ColumnMetadata(units=None, col_type=AnnotationType.text),
        },
        index_type_name="sample-with-metadata-added-later",
        data_df=pd.DataFrame(
            {
                "ID": [f"ID-1", f"ID-2", f"ID-3",],
                "label": [f"Label-1", f"Label-2", f"Label-3"],
            }
        ),
    )
    # Pyright now warns us that we shouldn't update values this way,
    # but it's still done in older parts of the codebase (and that's what I'm recreating here).
    dimension_type_with_later_added_metadata.dataset_id = (  # pyright: ignore
        tabular_dataset.id
    )
    minimal_db.flush()
    # This fails when the line below is not used
    minimal_db.refresh(dimension_type_with_later_added_metadata)

    assert dimension_type_with_later_added_metadata.dataset_id is not None
    assert dimension_type_with_later_added_metadata.dataset is not None
