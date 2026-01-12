"""add expiry to dataset

Revision ID: 9582be3ff65f
Revises: 020788c82611
Create Date: 2025-08-06 16:14:23.896702

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "9582be3ff65f"
down_revision = "020788c82611"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("dataset", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("expiry", sa.DateTime(timezone=True), nullable=True)
        )


def downgrade():
    with op.batch_alter_table("dataset", schema=None) as batch_op:
        batch_op.drop_column("expiry")
