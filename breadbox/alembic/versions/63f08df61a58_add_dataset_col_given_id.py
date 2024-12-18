"""add_dataset_col_given_id

Revision ID: 63f08df61a58
Revises: aadda1ee0328
Create Date: 2024-09-04 16:44:20.995091

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "63f08df61a58"
down_revision = "aadda1ee0328"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table("dataset", schema=None) as batch_op:
        batch_op.add_column(sa.Column("given_id", sa.String(), nullable=True))
        batch_op.create_unique_constraint(
            batch_op.f("uq_dataset_given_id"), ["given_id"]
        )

    op.execute(
        "UPDATE dataset SET given_id = json_extract(dataset_metadata, '$.legacy_dataset_id') WHERE json_extract(dataset_metadata, '$.legacy_dataset_id') not NULL;"
    )


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table("dataset", schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f("uq_dataset_given_id"), type_="unique")
        batch_op.drop_column("given_id")

    # ### end Alembic commands ###
