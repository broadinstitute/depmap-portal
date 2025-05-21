"""add_group_to_access_controlled_tables

Revision ID: 4648afd0f157
Revises: 9d51bb459968
Create Date: 2024-06-18 16:41:08.789762

"""
from alembic import op
from sqlalchemy import text
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "4648afd0f157"
down_revision = "9d51bb459968"
branch_labels = None
depends_on = None


def upgrade():
    # Turn off pragma FK bc previously running into an issue where running this migration script without that statement was causing TabularCell and DimensionSearchIndex tables records to be deleted. This is somehow related to the fact those tables don't have a direct FK relationship with the Dataset tables
    op.execute(text("PRAGMA foreign_keys = OFF"))

    with op.batch_alter_table("dataset_reference", schema=None) as batch_op:
        batch_op.add_column(sa.Column("group_id", sa.String(), nullable=True))
        batch_op.create_foreign_key(
            batch_op.f("fk_dataset_reference_group_id_group"),
            "group",
            ["group_id"],
            ["id"],
        )
        batch_op.add_column(
            sa.Column("referenced_group_id", sa.String(), nullable=True)
        )
        batch_op.create_foreign_key(
            batch_op.f("fk_dataset_reference_referenced_group_id_group"),
            "group",
            ["referenced_group_id"],
            ["id"],
        )

    with op.batch_alter_table("dimension", schema=None) as batch_op:
        batch_op.add_column(sa.Column("group_id", sa.String(), nullable=True))
        batch_op.create_foreign_key(
            batch_op.f("fk_dimension_group_id_group"), "group", ["group_id"], ["id"]
        )

    with op.batch_alter_table("dimension_search_index", schema=None) as batch_op:
        batch_op.add_column(sa.Column("group_id", sa.String(), nullable=True))
        batch_op.create_foreign_key(
            batch_op.f("fk_dimension_search_index_group_id_group"),
            "group",
            ["group_id"],
            ["id"],
        )

    with op.batch_alter_table("property_to_index", schema=None) as batch_op:
        batch_op.add_column(sa.Column("group_id", sa.String(), nullable=True))
        batch_op.create_foreign_key(
            batch_op.f("fk_property_to_index_group_id_group"),
            "group",
            ["group_id"],
            ["id"],
        )

    with op.batch_alter_table("tabular_cell", schema=None) as batch_op:
        batch_op.add_column(sa.Column("group_id", sa.String(), nullable=True))
        batch_op.create_foreign_key(
            batch_op.f("fk_tabular_cell_group_id_group"), "group", ["group_id"], ["id"]
        )


def downgrade():
    raise NotImplementedError()
