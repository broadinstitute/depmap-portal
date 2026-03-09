"""add etag to predictive_model_result

Revision ID: a1b2c3d4e5f6
Revises: eb9295846cb3
Create Date: 2026-03-09 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "eb9295846cb3"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("predictive_model_result", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("etag", sa.String(), nullable=False, server_default="")
        )


def downgrade():
    with op.batch_alter_table("predictive_model_result", schema=None) as batch_op:
        batch_op.drop_column("etag")
