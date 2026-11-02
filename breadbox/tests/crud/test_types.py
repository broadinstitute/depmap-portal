import pandas as pd
from sqlalchemy import select

from breadbox.db.session import SessionWithUser
from breadbox.service.dataset import add_dimension_type, update_dimension_type_metadata
from breadbox.models.dataset import DimensionTypeLabel, PropertyToIndex
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


def test_update_dimension_type_metadata_preserves_properties_to_index(
    minimal_db: SessionWithUser, settings
):
    """
    When the caller doesn't supply properties_to_index, the properties that were indexed
    before the metadata was replaced should remain indexed.
    """
    user = settings.admin_users[0]
    annotation_type_mapping = {
        "ID": AnnotationType.text,
        "label": AnnotationType.text,
        "group": AnnotationType.text,
    }
    dimension_type = add_dimension_type(
        minimal_db,
        settings,
        user=user,
        name="feature-with-index",
        id_column="ID",
        annotation_type_mapping=annotation_type_mapping,
        axis="feature",
        metadata_df=pd.DataFrame(
            {"ID": ["f1", "f2"], "label": ["old1", "old2"], "group": ["a", "b"],}
        ),
        properties_to_index=["group"],
    )
    minimal_db.flush()
    assert [p.property for p in dimension_type.properties_to_index] == ["group"]

    update_dimension_type_metadata(
        minimal_db,
        user,
        settings.filestore_location,
        dimension_type,
        None,
        pd.DataFrame(
            {
                "ID": ["f1", "f2", "f3"],
                "label": ["new1", "new2", "new3"],
                "group": ["c", "d", "e"],
            }
        ),
        annotation_type_mapping,
        None,
    )
    minimal_db.flush()

    rows = minimal_db.query(PropertyToIndex).filter_by(
        dimension_type_name="feature-with-index"
    )
    assert [r.property for r in rows] == ["group"]

    labels = dict(
        tuple(row)
        for row in minimal_db.connection().execute(
            select(DimensionTypeLabel.given_id, DimensionTypeLabel.label).where(
                DimensionTypeLabel.dimension_type_name == "feature-with-index"
            )
        )
    )
    assert labels == {"f1": "new1", "f2": "new2", "f3": "new3"}
