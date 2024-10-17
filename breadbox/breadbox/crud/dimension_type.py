from sqlalchemy import and_

from breadbox.db.session import SessionWithUser
from breadbox.models.dataset import (
    DimensionType,
    TabularColumn,
    TabularCell,
)


def get_dimension_type(db: SessionWithUser, name: str) -> DimensionType:
    """Get a dimension type object by name"""
    return db.query(DimensionType).filter(DimensionType.name == name).one()


def get_dimension_type_labels_by_id(
    db: SessionWithUser, dimension_type: DimensionType
) -> dict[str, str]:
    """
    For a given dimension, get all IDs and labels that exist in the metadata.
    """
    label_filter_statements = [
        TabularColumn.dataset_id == dimension_type.dataset_id,
        TabularColumn.given_id == "label",
    ]

    labels_by_id = (
        db.query(TabularCell)
        .join(TabularColumn)
        .filter(and_(True, *label_filter_statements))
        .with_entities(TabularCell.dimension_given_id, TabularCell.value)
        .all()
    )
    return labels_by_id
