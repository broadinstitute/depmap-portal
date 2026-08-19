"""add indices to flat_table

Revision ID: 5513a3b26601
Revises: 2dbaea90aec9
Create Date: 2026-07-24 13:49:19.455963

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5513a3b26601'
down_revision = '2dbaea90aec9'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('flat_table', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'indices', sa.JSON(), nullable=False, server_default='[]'
            )
        )


def downgrade():
    with op.batch_alter_table('flat_table', schema=None) as batch_op:
        batch_op.drop_column('indices')
