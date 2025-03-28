"""Add display name field to Dataset

Revision ID: 089bf0a70e1e
Revises: 63f08df61a58
Create Date: 2024-09-09 15:03:26.411163

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "089bf0a70e1e"
down_revision = "63f08df61a58"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("dimension_type", schema=None) as batch_op:
        # Make new column nullable first to avoid issues with existing rows that don't have a value for this column

        batch_op.add_column(sa.Column("display_name", sa.String(), nullable=True))

    # Update the new column with the values from the existing column
    conn = op.get_bind()
    conn.execute(sa.text("UPDATE dimension_type SET display_name = name"))

    # Update table with the same schema but with the new column as NOT NULL
    with op.batch_alter_table("dimension_type") as batch_op:
        batch_op.alter_column("display_name", existing_type=sa.String(), nullable=False)


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table("dimension_type", schema=None) as batch_op:
        batch_op.drop_column("display_name")

    # ### end Alembic commands ###
