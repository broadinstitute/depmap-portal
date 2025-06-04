"""Add MatrixDataset and TabularDataset tables

Revision ID: ca3273d177c6
Revises: 39173611e99b
Create Date: 2024-03-12 17:08:20.604126

"""
from alembic import op
from sqlalchemy import text
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers, used by Alembic.
revision = "ca3273d177c6"
down_revision = "39173611e99b"
branch_labels = None
depends_on = None


def upgrade():
    # Turn off FK enforcement for this migration only (the "PRAGMA foreign_keys" value resets on every DB connection)
    op.execute(text("PRAGMA foreign_keys = OFF"))

    op.create_table(
        "matrix_dataset",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("units", sa.String(), nullable=False),
        sa.Column("feature_type_name", sa.String(), nullable=True),
        sa.Column("sample_type_name", sa.String(), nullable=False),
        sa.Column(
            "value_type",
            sa.Enum("continuous", "categorical", name="valuetype"),
            nullable=True,
        ),
        sa.Column("allowed_values", sa.JSON(), nullable=True),
        sa.CheckConstraint(
            "NOT((value_type == 'categorical' AND allowed_values == 'null') OR (value_type == 'continuous' AND allowed_values != 'null') OR (value_type IS NULL AND allowed_values != 'null'))",
            name="ck_allowed_values_for_categorical_value_type",
        ),
        sa.CheckConstraint(
            "NOT(feature_type_name IS NULL AND sample_type_name IS NULL)",
            name="ck_feature_type_sample_type_names_not_null",
        ),
        sa.CheckConstraint(
            "feature_type_name != sample_type_name",
            name="ck_diff_sample_type_and_feature_type",
        ),
        sa.ForeignKeyConstraint(
            ["feature_type_name"],
            ["dimension_type.name"],
            name=op.f("fk_matrix_dataset_feature_type_name_dimension_type"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["id"],
            ["dataset.id"],
            name=op.f("fk_matrix_dataset_id_dataset"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["sample_type_name"],
            ["dimension_type.name"],
            name=op.f("fk_matrix_dataset_sample_type_name_dimension_type"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_matrix_dataset")),
    )
    op.create_table(
        "tabular_dataset",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("index_type_name", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ["id"],
            ["dataset.id"],
            name=op.f("fk_tabular_dataset_id_dataset"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["index_type_name"],
            ["dimension_type.name"],
            name=op.f("fk_tabular_dataset_index_type_name_dimension_type"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tabular_dataset")),
    )
    # Move feature type metadata to TabularDataset table
    op.execute(
        "INSERT INTO tabular_dataset ( id, index_type_name ) select id, feature_type_name from dataset where feature_type_name IS NOT NULL and sample_type_name IS NULL"
    )
    # Move sample type metadata to TabularDataset table
    op.execute(
        "INSERT INTO tabular_dataset ( id, index_type_name ) select id, sample_type_name from dataset where sample_type_name IS NOT NULL and feature_type_name IS NULL and value_type IS NULL"
    )
    # Matrix datasets
    op.execute(
        "INSERT INTO matrix_dataset ( id, units, feature_type_name, sample_type_name, value_type, allowed_values ) select id, units, feature_type_name, sample_type_name, value_type, allowed_values from dataset where value_type IS NOT NULL and sample_type_name IS NOT NULL"
    )

    op.create_table(
        "dataset_copy",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column(
            "data_type", sa.String(), nullable=False, server_default="User upload"
        ),
        sa.Column("priority", sa.Integer(), nullable=True),
        sa.Column("taiga_id", sa.String(), nullable=True),
        sa.Column("is_transient", sa.Boolean(), nullable=False),
        sa.Column("group_id", sa.String(), nullable=False),
        sa.Column("dataset_metadata", sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["group_id"], ["group.id"], name="fk_dataset_group_id_group"
        ),
        sa.ForeignKeyConstraint(
            ["data_type"],
            ["data_type.data_type"],
            name="fk_dataset_data_type_data_type",
        ),
        sa.UniqueConstraint("data_type", "priority", name="_data_type_priority_uc"),
    )
    op.execute(
        "INSERT INTO dataset_copy ( id, name, data_type, priority, taiga_id, is_transient, group_id, dataset_metadata ) select id, name, data_type, priority, taiga_id, is_transient, group_id, dataset_metadata from dataset"
    )
    op.drop_table("dataset")
    op.rename_table("dataset_copy", "dataset")
    # ### end Alembic commands ###


def downgrade():
    # NOTE: We rely on backups to restore previous db versions
    pass
