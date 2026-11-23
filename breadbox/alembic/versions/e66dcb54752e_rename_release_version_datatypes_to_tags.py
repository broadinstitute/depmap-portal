"""rename release version datatypes to tags

Revision ID: e66dcb54752e
Revises: f1b6d3a9c2e7
Create Date: 2026-11-23 16:16:08.431136

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e66dcb54752e"
down_revision = "f1b6d3a9c2e7"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Rename table and column in place (SQLite automatically updates inline UNIQUE constraints)
    op.rename_table("release_file_datatype", "release_file_tag")
    op.execute("ALTER TABLE release_file_tag RENAME COLUMN datatype TO tag")

    # 2. Recreate the FTS5 virtual table with `file_tags` instead of `file_datatypes`
    op.execute("DROP TABLE IF EXISTS release_file_search_index")
    op.execute(
        """
        CREATE VIRTUAL TABLE release_file_search_index USING fts5(
            file_id UNINDEXED,
            file_name,
            file_description,
            file_tags,
            release_version_name,
            release_name,
            release_version_description,
            release_version_content_hash UNINDEXED
        )
        """
    )

    # 3. Repopulate the FTS5 index from existing rows
    #    (Verify column names on release_file and release_version match your schema)
    op.execute(
        """
        INSERT INTO release_file_search_index (
            file_id,
            file_name,
            file_description,
            file_tags,
            release_version_name,
            release_name,
            release_version_description,
            release_version_content_hash
        )
        SELECT
            rf.id,
            rf.file_name,
            COALESCE(rf.description, ''),
            COALESCE(GROUP_CONCAT(rft.tag, ' '), ''),
            rv.version_name,
            rv.release_name,
            COALESCE(rv.description, ''),
            COALESCE(rv.content_hash, '')
        FROM release_file rf
        JOIN release_version rv ON rf.release_version_id = rv.id
        LEFT JOIN release_file_tag rft ON rft.release_file_id = rf.id
        GROUP BY rf.id
        """
    )


def downgrade():
    # 1. Restore FTS5 virtual table with `file_datatypes`
    op.execute("DROP TABLE IF EXISTS release_file_search_index")
    op.execute(
        """
        CREATE VIRTUAL TABLE release_file_search_index USING fts5(
            file_id UNINDEXED,
            file_name,
            file_description,
            file_datatypes,
            release_version_name,
            release_name,
            release_version_description,
            release_version_content_hash UNINDEXED
        )
        """
    )

    # 2. Revert column and table names
    op.execute("ALTER TABLE release_file_tag RENAME COLUMN tag TO datatype")
    op.rename_table("release_file_tag", "release_file_datatype")

    # 3. Repopulate FTS5 index
    op.execute(
        """
        INSERT INTO release_file_search_index (
            file_id,
            file_name,
            file_description,
            file_datatypes,
            release_version_name,
            release_name,
            release_version_description,
            release_version_content_hash
        )
        SELECT
            rf.id,
            rf.file_name,
            COALESCE(rf.description, ''),
            COALESCE(GROUP_CONCAT(rfd.datatype, ' '), ''),
            rv.version_name,
            rv.release_name,
            COALESCE(rv.description, ''),
            COALESCE(rv.content_hash, '')
        FROM release_file rf
        JOIN release_version rv ON rf.release_version_id = rv.id
        LEFT JOIN release_file_datatype rfd ON rfd.release_file_id = rf.id
        GROUP BY rf.id
        """
    )
