"""Rename DimensionAnnotationMetadata and AnnotaionValue to TabularColumn and TabularCell

Revision ID: 39173611e99b
Revises: 3f9fe9c464ef
Create Date: 2024-03-07 15:31:27.635330

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "39173611e99b"
down_revision = "3f9fe9c464ef"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    with op.batch_alter_table("dimension", schema=None) as batch_op:
        batch_op.drop_constraint("ck_index_with_dim_subtype", type_="check")
        batch_op.drop_constraint("ck_annotation_type_with_dim_subtype", type_="check")
    conn.execute(
        "update dimension set subtype='tabular_column' where subtype = 'dimension_annotation_metadata'"
    )
    with op.batch_alter_table("dimension", schema=None) as batch_op:
        batch_op.create_check_constraint(
            "ck_index_with_dim_subtype",
            "((subtype == 'tabular_column' AND 'index' IS NULL) OR NOT(subtype == 'dataset_sample' AND 'index' IS NULL) OR NOT(subtype == 'dataset_feature' AND 'index' IS NULL))",
        )
        batch_op.create_check_constraint(
            "ck_annotation_type_with_dim_subtype",
            "(subtype == 'dataset_feature' AND annotation_type IS NULL) OR (subtype == 'dataset_sample' AND annotation_type IS NULL) OR (subtype == 'tabular_column' AND NOT(annotation_type IS NULL))",
        )

    op.create_table(
        "tabular_cell",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("tabular_column_id", sa.String(), nullable=True),
        sa.Column("dimension_given_id", sa.String(), nullable=False),
        sa.Column("value", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["tabular_column_id"],
            ["dimension.id"],
            name=op.f("fk_tabular_cell_tabular_column_id_dimension"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tabular_cell")),
        sa.UniqueConstraint(
            "dimension_given_id",
            "tabular_column_id",
            name=op.f("uq_tabular_cell_dimension_given_id"),
        ),
    )
    with op.batch_alter_table("tabular_cell", schema=None) as batch_op:
        batch_op.create_index(
            "idx_tabular_column_id_dimension_given_id",
            ["tabular_column_id", "dimension_given_id"],
            unique=False,
        )

    with op.batch_alter_table("annotation_value", schema=None) as batch_op:
        batch_op.drop_index("idx_dimension_annotation_id_dimension_given_id")

    conn.execute(
        "INSERT INTO tabular_cell ( tabular_column_id, dimension_given_id, value ) select dimension_annotation_id, dimension_given_id, value from annotation_value"
    )

    op.drop_table("annotation_value")
    # ### end Alembic commands ###


def downgrade():
    conn = op.get_bind()
    op.create_table(
        "annotation_value",
        sa.Column("id", sa.INTEGER(), nullable=False),
        sa.Column("dimension_annotation_id", sa.VARCHAR(), nullable=True),
        sa.Column("dimension_given_id", sa.VARCHAR(), nullable=False),
        sa.Column("value", sa.TEXT(), nullable=True),
        sa.ForeignKeyConstraint(
            ["dimension_annotation_id"],
            ["dimension.id"],
            name="fk_annotation_value_dimension_annotation_id_dimension",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_annotation_value"),
        sa.UniqueConstraint(
            "dimension_given_id",
            "dimension_annotation_id",
            name="uq_annotation_value_dimension_given_id",
        ),
    )
    with op.batch_alter_table("annotation_value", schema=None) as batch_op:
        batch_op.create_index(
            "idx_dimension_annotation_id_dimension_given_id",
            ["dimension_annotation_id", "dimension_given_id"],
            unique=False,
        )

    conn.execute(
        "INSERT INTO annotation_value ( dimension_annotation_id, dimension_given_id, value ) select tabular_column_id, dimension_given_id, value from annotation_value"
    )
    with op.batch_alter_table("tabular_cell", schema=None) as batch_op:
        batch_op.drop_index("idx_tabular_column_id_dimension_given_id")

    op.drop_table("tabular_cell")

    with op.batch_alter_table("dimension", schema=None) as batch_op:
        batch_op.drop_constraint("ck_index_with_dim_subtype", type_="check")
        batch_op.drop_constraint("ck_annotation_type_with_dim_subtype", type_="check")
    conn.execute(
        "update dimension set subtype='dimension_annotation_metadata' where subtype = 'tabular_column'"
    )
    with op.batch_alter_table("dimension", schema=None) as batch_op:
        batch_op.create_check_constraint(
            "ck_index_with_dim_subtype",
            "((subtype == 'dimension_annotation_metadata' AND 'index' IS NULL) OR NOT(subtype == 'dataset_sample' AND 'index' IS NULL) OR NOT(subtype == 'dataset_feature' AND 'index' IS NULL))",
        )
        batch_op.create_check_constraint(
            "ck_annotation_type_with_dim_subtype",
            "(subtype == 'dataset_feature' AND annotation_type IS NULL) OR (subtype == 'dataset_sample' AND annotation_type IS NULL) OR (subtype == 'dimension_annotation_metadata' AND NOT(annotation_type IS NULL))",
        )

    # ### end Alembic commands ###
