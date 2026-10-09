"""add table_mutation

Revision ID: c7d2e9a4b1f3
Revises: bd6abe9454f9
Create Date: 2026-10-08 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

from breadbox.models.table_mutation import (
    drop_mutation_trigger_statements,
    mutation_trigger_statements,
    seed_statement,
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
