"""release file datatypes many to many

Revision ID: bd6abe9454f9
Revises: 5513a3b26601
Create Date: 2026-09-03 12:38:58.366886

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "bd6abe9454f9"
down_revision = "5513a3b26601"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Create the join table backing ReleaseFile.datatypes (a set of free-text
    # values, not FK'd to the `data_type` lookup table used by Dataset).
    op.create_table(
        "release_file_datatype",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("release_file_id", sa.String(), nullable=False),
        sa.Column("datatype", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ["release_file_id"],
            ["release_file.id"],
            name=op.f("fk_release_file_datatype_release_file_id_release_file"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_release_file_datatype")),
        sa.UniqueConstraint(
            "release_file_id",
            "datatype",
            name=op.f("uq_release_file_datatype_release_file_id"),
        ),
    )

    # 2. Backfill: one row per existing release_file.datatype
    op.execute(
        """
        INSERT INTO release_file_datatype (release_file_id, datatype)
        SELECT id, datatype FROM release_file
        """
    )

    # 3. Drop the old single-valued column (SQLite requires batch mode)
    with op.batch_alter_table("release_file", schema=None) as batch_op:
        batch_op.drop_column("datatype")

    # 4. Rebuild the FTS5 search index with file_datatypes in place of
    # file_datatype. FTS5 virtual tables don't support ALTER COLUMN, so we
    # drop and recreate, then repopulate from the current source tables.
    op.execute("DROP TABLE IF EXISTS release_file_search_index")
    op.execute(
        """
        CREATE VIRTUAL TABLE release_file_search_index USING fts5(
        file_id,
        file_name,
        file_description,
        file_datatypes,
        release_version_name,
        release_name,
        release_version_description,
        release_version_content_hash,
        tokenize='unicode61'
        );
        """
    )
    op.execute(
        """
        INSERT INTO release_file_search_index
            (file_id, file_name, file_description, file_datatypes,
             release_version_name, release_name, release_version_description,
             release_version_content_hash)
        SELECT
            rf.id, rf.file_name, COALESCE(rf.description, ''),
            (SELECT group_concat(rfd.datatype, ' ')
             FROM release_file_datatype rfd WHERE rfd.release_file_id = rf.id),
            rv.version_name, rv.release_name, COALESCE(rv.description, ''),
            rv.content_hash
        FROM release_file rf
        JOIN release_version rv ON rv.id = rf.release_version_id
        """
    )


def downgrade():
    raise NotImplementedError("Downgrades are not supported")
