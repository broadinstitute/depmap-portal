"""populate_new_group_columns

Revision ID: cf1c8833c9f7
Revises: 4648afd0f157
Create Date: 2024-06-20 12:44:18.345708

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "cf1c8833c9f7"
down_revision = "4648afd0f157"
branch_labels = None
depends_on = None


def upgrade():
    def _set_group_id_from_dataset_fk(batch_op, table_name: str):
        """Assuming the given table has a dataset_id field, use that to set the group id."""
        batch_op.execute(
            f"""
            UPDATE {table_name} SET group_id = (
                SELECT dataset.group_id from dataset WHERE dataset.id = {table_name}.dataset_id
            );
        """
        )

    with op.batch_alter_table("dataset_reference", schema=None) as batch_op:
        _set_group_id_from_dataset_fk(batch_op, table_name="dataset_reference")
        batch_op.alter_column("group_id", existing_type=sa.VARCHAR(), nullable=False)
        batch_op.execute(
            f"""
            UPDATE dataset_reference SET referenced_group_id = (
                SELECT dataset.group_id from dataset WHERE dataset.id = dataset_reference.referenced_dataset_id
            );
        """
        )
        batch_op.alter_column(
            "referenced_group_id", existing_type=sa.VARCHAR(), nullable=False
        )

    with op.batch_alter_table("dimension", schema=None) as batch_op:
        _set_group_id_from_dataset_fk(batch_op, table_name="dimension")
        batch_op.alter_column("group_id", existing_type=sa.VARCHAR(), nullable=False)

    with op.batch_alter_table("dimension_search_index", schema=None) as batch_op:
        batch_op.execute(
            f"""
            UPDATE dimension_search_index SET group_id = (
                SELECT dimension.group_id from dimension WHERE dimension.id = dimension_search_index.dimension_id
            );
        """
        )
        batch_op.alter_column("group_id", existing_type=sa.VARCHAR(), nullable=False)

    with op.batch_alter_table("property_to_index", schema=None) as batch_op:
        _set_group_id_from_dataset_fk(batch_op, table_name="property_to_index")
        batch_op.alter_column("group_id", existing_type=sa.VARCHAR(), nullable=False)

    with op.batch_alter_table("tabular_cell", schema=None) as batch_op:
        batch_op.execute(
            f"""
            UPDATE tabular_cell SET group_id = (
                SELECT dimension.group_id from dimension WHERE dimension.id = tabular_cell.tabular_column_id
            );
        """
        )
        batch_op.alter_column("group_id", existing_type=sa.VARCHAR(), nullable=False)


def downgrade():
    raise NotImplementedError()
