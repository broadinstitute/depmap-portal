"""add index for deletes

Revision ID: 2827327b2bd5
Revises: 01948b8d9c15
Create Date: 2024-04-22 09:54:30.622453

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2827327b2bd5"
down_revision = "01948b8d9c15"
branch_labels = None
depends_on = None


def upgrade():
    # clean up any bad records before adding fk constraint
    op.execute(
        "delete from dataset_reference where not exists (select 1 from dataset where dataset.id = referenced_dataset_id)"
    )

    with op.batch_alter_table("dataset_reference", schema=None) as batch_op:
        batch_op.create_foreign_key(
            batch_op.f("fk_dataset_reference_referenced_dataset_id_dataset"),
            "dataset",
            ["referenced_dataset_id"],
            ["id"],
            ondelete="CASCADE",
        )

    with op.batch_alter_table("catalog_node", schema=None) as batch_op:
        batch_op.create_index(
            "idx_catalog_node_dimension_id", ["dimension_id"], unique=False
        )

    with op.batch_alter_table("dimension", schema=None) as batch_op:
        batch_op.alter_column(
            "annotation_type",
            existing_type=sa.VARCHAR(length=11),
            type_=sa.Enum(
                "continuous",
                "categorical",
                "binary",
                "text",
                "list_strings",
                name="annotationtype",
            ),
            existing_nullable=True,
        )
        batch_op.drop_column("feature_label")

    with op.batch_alter_table("dimension_search_index", schema=None) as batch_op:
        batch_op.create_index(
            "idx_dimension_search_index_dimension_id", ["dimension_id"], unique=False
        )


def downgrade():
    with op.batch_alter_table("dimension_search_index", schema=None) as batch_op:
        batch_op.drop_index("idx_dimension_search_index_dimension_id")

    with op.batch_alter_table("dimension", schema=None) as batch_op:
        batch_op.add_column(sa.Column("feature_label", sa.VARCHAR(), nullable=True))
        batch_op.alter_column(
            "annotation_type",
            existing_type=sa.Enum(
                "continuous",
                "categorical",
                "binary",
                "text",
                "list_strings",
                name="annotationtype",
            ),
            type_=sa.VARCHAR(length=11),
            existing_nullable=True,
        )

    with op.batch_alter_table("dataset_reference", schema=None) as batch_op:
        batch_op.drop_constraint(
            batch_op.f("fk_dataset_reference_referenced_dataset_id_dataset"),
            type_="foreignkey",
        )

    with op.batch_alter_table("catalog_node", schema=None) as batch_op:
        batch_op.drop_index("idx_catalog_node_dimension_id")
