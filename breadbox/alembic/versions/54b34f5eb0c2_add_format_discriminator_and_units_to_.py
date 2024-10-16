"""Add format discriminator and units to TabularColumn

Revision ID: 54b34f5eb0c2
Revises: ca3273d177c6
Create Date: 2024-03-15 14:56:31.164478

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import Table, MetaData


# revision identifiers, used by Alembic.
revision = "54b34f5eb0c2"
down_revision = "ca3273d177c6"
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()

    op.add_column("dataset", sa.Column("format", sa.String(), nullable=True))

    all_matrix_ids = connection.execute("select id from matrix_dataset").fetchall()

    for tuple in all_matrix_ids:
        matrix_id = tuple[0]
        op.execute(
            f"update dataset set format='matrix_dataset' where id = '{matrix_id}'"
        )

    all_tabular_ids = connection.execute("select id from tabular_dataset").fetchall()

    for tuple in all_tabular_ids:
        tabular_id = tuple[0]
        op.execute(
            f"update dataset set format='tabular_dataset' where id = '{tabular_id}'"
        )

    with op.batch_alter_table("dataset", schema=None) as batch_op:
        batch_op.create_check_constraint(
            "dataset_format",
            "format == 'tabular_dataset' OR format ==  'matrix_dataset'",
        )
        batch_op.alter_column("format", nullable=False)

    with op.batch_alter_table("dimension", schema=None) as batch_op:
        batch_op.add_column(sa.Column("units", sa.String(), nullable=True))
        batch_op.create_check_constraint(
            "units_for_tabular_subtype",
            "NOT(NOT(units is NULL) AND subtype!='tabular_column')",
        )

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table("dimension", schema=None) as batch_op:
        batch_op.drop_constraint("units_for_tabular_subtype", type_="check")
        batch_op.drop_column("units")

    with op.batch_alter_table("dataset", schema=None) as batch_op:
        batch_op.drop_constraint("dataset_format", type_="check")
        batch_op.drop_column("format")

    # ### end Alembic commands ###
