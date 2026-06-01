"""add_assoc_config

Revision ID: 986e6da107d1
Revises: a33ed87f86ff
Create Date: 2026-06-01 10:11:34.448999

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "986e6da107d1"
down_revision = "a33ed87f86ff"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("precomputed_association", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("config", sa.String(), nullable=False, server_default="default")
        )
        batch_op.drop_constraint("assoc_params_uc", type_="unique")
        batch_op.create_unique_constraint(
            "assoc_params_uc", ["dataset_1_id", "dataset_2_id", "axis", "config"]
        )


def downgrade():
    with op.batch_alter_table("precomputed_association", schema=None) as batch_op:
        batch_op.drop_constraint("assoc_params_uc", type_="unique")
        batch_op.create_unique_constraint(
            "assoc_params_uc", ["dataset_1_id", "dataset_2_id", "axis"]
        )
        batch_op.drop_column("config")
