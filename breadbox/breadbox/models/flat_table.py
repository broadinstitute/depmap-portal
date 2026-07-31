from typing import Optional

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from breadbox.db.base_class import Base, UUIDMixin


class FlatTable(Base, UUIDMixin):
    """
    An arbitrary uploaded table, stored as a per-table SQLite file (see `sqlite_db_path`).
    Unlike a tabular Dataset, there is not necessarily a unique ID column.

    given_id identifies the *current* version of a table: it's kept unique at the DB level,
    but reusing an existing given_id on a new upload "supersedes" the old row by clearing the
    old row's given_id (see crud/flat_table.py). The old row is left in place, still reachable
    by its own `id`.
    """

    __tablename__ = "flat_table"

    given_id: Mapped[Optional[str]] = mapped_column(String, unique=True, nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)

    # relative path, rooted at settings.filestore_location, to the sqlite file containing
    # the actual row data (table name "data" within that file)
    sqlite_db_path: Mapped[str] = mapped_column(String, nullable=False)

    row_count: Mapped[int] = mapped_column(Integer, nullable=False)

    taiga_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # named flat_table_metadata (not "metadata") because Base.metadata is a reserved
    # attribute name on declarative model classes
    flat_table_metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    columns = relationship(
        "FlatTableColumn",
        order_by="FlatTableColumn.position",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=True,
    )


class FlatTableColumn(Base, UUIDMixin):
    "One column's metadata for a FlatTable, in display order (see `position`)."

    __tablename__ = "flat_table_column"
    __table_args__ = (
        UniqueConstraint(
            "flat_table_id",
            "given_id",
            name="uq_flat_table_column_flat_table_id_given_id",
        ),
        Index("idx_flat_table_column_flat_table_id", "flat_table_id"),
    )

    flat_table_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("flat_table.id", ondelete="CASCADE"), nullable=False
    )

    # how the column is named in the uploaded file
    given_id: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)

    # if set, indicates this column's values are IDs in the named Dimension type. Metadata
    # only -- breadbox does not resolve or otherwise interpret it.
    references: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # "string" | "int" | "float" (schemas.flat_table.ColumnType)
    type: Mapped[str] = mapped_column(String, nullable=False)

    # 0-indexed position in the display order for this table's columns
    position: Mapped[int] = mapped_column(Integer, nullable=False)
