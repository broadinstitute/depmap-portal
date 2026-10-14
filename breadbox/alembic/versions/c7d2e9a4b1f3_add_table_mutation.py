"""add table_mutation

Revision ID: c7d2e9a4b1f3
Revises: bd6abe9454f9
Create Date: 2026-10-08 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# NOTE: these helpers used to live in breadbox/models/table_mutation.py, which was removed when
# table_mutation was replaced by cache_version. They're inlined here so this migration still runs.
EVENTS = ("INSERT", "UPDATE", "DELETE")


def _trigger_name(table_name, trigger_event):
    return f"trg_{table_name}_{trigger_event.lower()}_mutation"


def mutation_trigger_statements(table_name):
    return [
        f"CREATE TRIGGER IF NOT EXISTS {_trigger_name(table_name, e)} "
        f'AFTER {e} ON "{table_name}" '
        f"BEGIN UPDATE table_mutation SET count = count + 1 WHERE name = '{table_name}'; END"
        for e in EVENTS
    ]


def drop_mutation_trigger_statements(table_name):
    return [f"DROP TRIGGER IF EXISTS {_trigger_name(table_name, e)}" for e in EVENTS]


def seed_statement(table_name):
    return (
        f"INSERT OR IGNORE INTO table_mutation (name, count) VALUES ('{table_name}', 0)"
    )


# revision identifiers, used by Alembic.
revision = "c7d2e9a4b1f3"
down_revision = "bd6abe9454f9"
branch_labels = None
depends_on = None

# Tables whose mutations are counted. These are the tables which affect the etags of
# get_datasets and get_dimension_type_identifiers.
TRACKED_TABLES = [
    "dataset",
    "tabular_dataset",
    "matrix_dataset",
    "group",
    "group_entry",
    "dimension_type",
]


def upgrade():
    op.create_table(
        "table_mutation",
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("count", sa.Integer(), server_default="0", nullable=False),
        sa.PrimaryKeyConstraint("name", name=op.f("pk_table_mutation")),
    )
    for table_name in TRACKED_TABLES:
        op.execute(seed_statement(table_name))
        for statement in mutation_trigger_statements(table_name):
            op.execute(statement)


def downgrade():
    for table_name in TRACKED_TABLES:
        for statement in drop_mutation_trigger_statements(table_name):
            op.execute(statement)
    op.drop_table("table_mutation")
