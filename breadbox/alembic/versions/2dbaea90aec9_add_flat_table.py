"""add flat_table table

Revision ID: 2dbaea90aec9
Revises: a33ed87f86ff
Create Date: 2026-07-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2dbaea90aec9"
down_revision = "a33ed87f86ff"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "flat_table",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("given_id", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("sqlite_db_path", sa.String(), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("taiga_id", sa.String(), nullable=True),
        sa.Column("flat_table_metadata", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_flat_table")),
        sa.UniqueConstraint("given_id", name=op.f("uq_flat_table_given_id")),
    )
    op.create_table(
        "flat_table_column",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("flat_table_id", sa.String(length=36), nullable=False),
        sa.Column("given_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("references", sa.String(), nullable=True),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["flat_table_id"],
            ["flat_table.id"],
            name=op.f("fk_flat_table_column_flat_table_id_flat_table"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_flat_table_column")),
        sa.UniqueConstraint(
            "flat_table_id",
            "given_id",
            name="uq_flat_table_column_flat_table_id_given_id",
        ),
    )
    with op.batch_alter_table("flat_table_column", schema=None) as batch_op:
        batch_op.create_index(
            "idx_flat_table_column_flat_table_id", ["flat_table_id"], unique=False
        )


def downgrade():
    with op.batch_alter_table("flat_table_column", schema=None) as batch_op:
        batch_op.drop_index("idx_flat_table_column_flat_table_id")

    op.drop_table("flat_table_column")
    op.drop_table("flat_table")
