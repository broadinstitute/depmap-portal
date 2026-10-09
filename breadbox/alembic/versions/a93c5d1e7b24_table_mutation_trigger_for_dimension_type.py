"""add table_mutation triggers for dimension_type

Revision ID: a93c5d1e7b24
Revises: e41b7a09d3c2
Create Date: 2026-10-08 12:00:00.000000

"""
from alembic import op

from breadbox.models.table_mutation import (
    drop_mutation_trigger_statements,
    mutation_trigger_statements,
    seed_statement,
)


# revision identifiers, used by Alembic.
revision = "a93c5d1e7b24"
down_revision = "e41b7a09d3c2"
branch_labels = None
depends_on = None

TRACKED_TABLES = ["dimension_type"]


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
