"""add config_name to precomputed_association

Revision ID: f1b6d3a9c2e7
Revises: e4a8c1d7b923
Create Date: 2026-11-18 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f1b6d3a9c2e7"
down_revision = "e4a8c1d7b923"
branch_labels = None
depends_on = None


def upgrade():
    # server_default populates all existing rows with "default"
    with op.batch_alter_table("precomputed_association", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "config_name", sa.String(), nullable=False, server_default="default"
            )
        )
        batch_op.drop_constraint("assoc_params_uc", type_="unique")
        batch_op.create_unique_constraint(
            "assoc_params_uc", ["dataset_1_id", "dataset_2_id", "axis", "config_name"]
        )


def downgrade():
    # NOTE: this will fail if multiple rows now exist which differ only by config_name
    with op.batch_alter_table("precomputed_association", schema=None) as batch_op:
        batch_op.drop_constraint("assoc_params_uc", type_="unique")
        batch_op.create_unique_constraint(
            "assoc_params_uc", ["dataset_1_id", "dataset_2_id", "axis"]
        )
        batch_op.drop_column("config_name")
