import os
from typing import List, Optional, Union
from uuid import UUID

from sqlalchemy import or_

from breadbox.db.session import SessionWithUser
from breadbox.models.flat_table import FlatTable, FlatTableColumn
from breadbox.schemas.flat_table import FlatTableColumnMetadata, FlatTableUpdateParams


def get_flat_table(
    db: SessionWithUser, flat_table_id: Union[str, UUID]
) -> Optional[FlatTable]:
    "Get a flat table by its UUID, or by the given_id of its current version."
    return (
        db.query(FlatTable)
        .filter(
            or_(
                FlatTable.id == str(flat_table_id),
                FlatTable.given_id == str(flat_table_id),
            )
        )
        .one_or_none()
    )


def get_flat_tables(db: SessionWithUser) -> List[FlatTable]:
    "List all flat tables, including superseded versions (given_id is None for those)."
    return db.query(FlatTable).order_by(FlatTable.name).all()


def _supersede_given_id_holder(
    db: SessionWithUser, given_id: str, keep_id: Optional[str]
):
    """
    If some other FlatTable row currently holds `given_id`, clear its given_id so that
    `given_id` can be claimed by the row identified by `keep_id` (or a brand new row, if
    keep_id is None). The old row is left otherwise untouched -- still reachable by its id.
    """
    existing = db.query(FlatTable).filter(FlatTable.given_id == given_id).one_or_none()
    if existing is not None and existing.id != keep_id:
        existing.given_id = None
        db.flush()


def create_flat_table(
    db: SessionWithUser,
    id: str,
    given_id: str,
    name: str,
    sqlite_db_path: str,
    row_count: int,
    columns: List[FlatTableColumnMetadata],
    taiga_id: Optional[str],
    metadata: Optional[dict],
) -> FlatTable:
    _supersede_given_id_holder(db, given_id, keep_id=None)

    flat_table = FlatTable(
        id=id,
        given_id=given_id,
        name=name,
        sqlite_db_path=sqlite_db_path,
        row_count=row_count,
        taiga_id=taiga_id,
        flat_table_metadata=metadata,
        columns=[
            FlatTableColumn(
                given_id=column.given_id,
                name=column.name,
                references=column.references,
                type=column.type.value,
                position=position,
            )
            for position, column in enumerate(columns)
        ],
    )
    db.add(flat_table)
    db.flush()
    return flat_table


def update_flat_table(
    db: SessionWithUser, flat_table: FlatTable, update: FlatTableUpdateParams,
) -> FlatTable:
    "Only fields present in the request body (per exclude_unset) are touched -- e.g. an explicit `given_id: null` clears it, but an omitted given_id leaves it alone."
    update_data = update.model_dump(exclude_unset=True)

    if "given_id" in update_data:
        given_id = update_data["given_id"]
        if given_id is not None and given_id != flat_table.given_id:
            _supersede_given_id_holder(db, given_id, keep_id=flat_table.id)
        flat_table.given_id = given_id

    if "name" in update_data:
        flat_table.name = update_data["name"]

    db.flush()
    return flat_table


def delete_flat_table(
    db: SessionWithUser, flat_table: FlatTable, filestore_location: str
):
    "Delete a FlatTable row and its underlying SQLite data file."
    full_path = os.path.join(filestore_location, flat_table.sqlite_db_path)
    db.delete(flat_table)
    db.flush()
    if os.path.exists(full_path):
        os.remove(full_path)
