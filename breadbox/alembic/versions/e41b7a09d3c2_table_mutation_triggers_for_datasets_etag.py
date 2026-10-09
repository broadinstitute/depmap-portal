"""add table_mutation triggers for tables which affect get_datasets

Revision ID: e41b7a09d3c2
Revises: c7d2e9a4b1f3
Create Date: 2026-10-08 11:00:00.000000

"""
from alembic import op

from breadbox.models.table_mutation import (
    drop_mutation_trigger_statements,
    mutation_trigger_statements,
    seed_statement,
)


# revision identifiers, used by Alembic.
revision = "e41b7a09d3c2"
down_revision = "c7d2e9a4b1f3"
branch_labels = None
depends_on = None

# "dataset" was handled by the previous migration
TRACKED_TABLES = ["tabular_dataset", "matrix_dataset", "group", "group_entry"]


def upgrade():
    for table_name in TRACKED_TABLES:
        op.execute(seed_statement(table_name))
        for statement in mutation_trigger_statements(table_name):
            op.execute(statement)


def downgrade():
    for table_name in TRACKED_TABLES:
        for statement in drop_mutation_trigger_statements(table_name):
            op.execute(statement)
        op.execute(f"DELETE FROM table_mutation WHERE name = '{table_name}'")
