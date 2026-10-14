"""replace table_mutation with cache_version

Revision ID: e4a8c1d7b923
Revises: c7d2e9a4b1f3
Create Date: 2026-10-14 10:00:00.000000

"""
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e4a8c1d7b923"
down_revision = "c7d2e9a4b1f3"
branch_labels = None
depends_on = None

# Tables which had mutation triggers in c7d2e9a4b1f3
TRACKED_TABLES = [
    "dataset",
    "tabular_dataset",
    "matrix_dataset",
    "group",
    "group_entry",
    "dimension_type",
]
EVENTS = ("INSERT", "UPDATE", "DELETE")

# See breadbox/crud/cache_invalidation.py
CACHE_KEYS = ["get_datasets()", "get_datasets(PUBLIC)", "dimension_types"]


def _trigger_name(table_name, trigger_event):
    return f"trg_{table_name}_{trigger_event.lower()}_mutation"


def upgrade():
    for table_name in TRACKED_TABLES:
        for e in EVENTS:
            op.execute(f"DROP TRIGGER IF EXISTS {_trigger_name(table_name, e)}")
    op.drop_table("table_mutation")

    cache_version = op.create_table(
        "cache_version",
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("version", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("key", name=op.f("pk_cache_version")),
    )
    op.bulk_insert(
        cache_version, [{"key": key, "version": uuid.uuid4().hex} for key in CACHE_KEYS]
    )


def downgrade():
    op.drop_table("cache_version")

    op.create_table(
        "table_mutation",
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("count", sa.Integer(), server_default="0", nullable=False),
        sa.PrimaryKeyConstraint("name", name=op.f("pk_table_mutation")),
    )
    for table_name in TRACKED_TABLES:
        op.execute(
            f"INSERT OR IGNORE INTO table_mutation (name, count) VALUES ('{table_name}', 0)"
        )
        for e in EVENTS:
            op.execute(
                f"CREATE TRIGGER IF NOT EXISTS {_trigger_name(table_name, e)} "
                f'AFTER {e} ON "{table_name}" '
                f"BEGIN UPDATE table_mutation SET count = count + 1 WHERE name = '{table_name}'; END"
            )
