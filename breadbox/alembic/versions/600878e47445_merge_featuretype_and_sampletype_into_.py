"""Merge FeatureType and SampleType into DimensionType

Revision ID: 600878e47445
Revises: 2ddb197f8eec
Create Date: 2024-01-10 11:23:03.858371

"""
from alembic import op
import sqlalchemy as sa
import json
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = "600878e47445"
down_revision = "2ddb197f8eec"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    dimension_type = op.create_table(
        "dimension_type",
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("id_column", sa.String(), nullable=False),
        sa.Column("axis", sa.String(), nullable=False),
        sa.Column("dataset_id", sa.String(), nullable=True),
        sa.CheckConstraint("(axis == 'feature') OR (axis == 'sample')", name="ck_axis"),
        sa.ForeignKeyConstraint(
            ["dataset_id"],
            ["dataset.id"],
            name=op.f("fk_dimension_type_dataset_id_dataset"),
        ),
        sa.PrimaryKeyConstraint("name"),
    )
    all_feature_types = conn.execute(text("select * from feature_type")).fetchall()
    feature_type_insert_dimension_type = [
        {
            "name": feature_type_tuple[0],
            "id_column": feature_type_tuple[1],
            "axis": "feature",
            "dataset_id": feature_type_tuple[2],
        }
        for feature_type_tuple in all_feature_types
    ]
    op.bulk_insert(dimension_type, feature_type_insert_dimension_type)
    all_sample_types = conn.execute(text("select * from sample_type")).fetchall()
    sample_type_insert_dimension_type = [
        {
            "name": sample_type_tuple[0],
            "id_column": sample_type_tuple[1],
            "axis": "sample",
            "dataset_id": sample_type_tuple[2],
        }
        for sample_type_tuple in all_sample_types
    ]
    op.bulk_insert(dimension_type, sample_type_insert_dimension_type)

    annotation_value = op.create_table(
        "annotation_value",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("dimension_annotation_id", sa.String(), nullable=True),
        sa.Column("dimension_given_id", sa.String(), nullable=False),
        sa.Column("value", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["dimension_annotation_id"],
            ["dimension.id"],
            name=op.f("fk_annotation_value_dimension_annotation_id_dimension"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("dimension_given_id", "dimension_annotation_id"),
    )

    with op.batch_alter_table("annotation_value", schema=None) as batch_op:
        batch_op.create_index(
            "idx_dimension_annotation_id_dimension_given_id",
            ["dimension_annotation_id", "dimension_given_id"],
            unique=False,
        )
    all_feature_annotation_values = conn.execute(
        text("select * from feature_annotation_value")
    ).fetchall()
    feature_annotation_value_insert_annotation_value = [
        {
            "dimension_annotation_id": feature_annotation_value_tuple[1],
            "dimension_given_id": feature_annotation_value_tuple[2],
            "value": feature_annotation_value_tuple[3],
        }
        for feature_annotation_value_tuple in all_feature_annotation_values
    ]
    op.bulk_insert(annotation_value, feature_annotation_value_insert_annotation_value)
    all_sample_annotation_values = conn.execute(
        text("select * from sample_annotation_value")
    ).fetchall()
    sample_annotation_value_insert_annotation_value = [
        {
            "dimension_annotation_id": sample_annotation_value_tuple[1],
            "dimension_given_id": sample_annotation_value_tuple[2],
            "value": sample_annotation_value_tuple[3],
        }
        for sample_annotation_value_tuple in all_sample_annotation_values
    ]
    op.bulk_insert(annotation_value, sample_annotation_value_insert_annotation_value)

    with op.batch_alter_table("feature_annotation_value", schema=None) as batch_op:
        batch_op.drop_index("idx_feature_annotation_id_feature_id")

    op.drop_table("feature_annotation_value")

    with op.batch_alter_table("sample_annotation_value", schema=None) as batch_op:
        batch_op.drop_index("idx_sample_annotation_id_sample_id")

    op.drop_table("sample_annotation_value")

    dataset_copy = op.create_table(
        "dataset_copy",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("units", sa.String(), nullable=False),
        sa.Column("feature_type_name", sa.String(), nullable=True),
        sa.Column("sample_type_name", sa.String(), nullable=True),
        sa.Column(
            "data_type", sa.String(), nullable=False, server_default="User upload"
        ),
        sa.Column("priority", sa.Integer(), nullable=True),
        sa.Column("taiga_id", sa.String(), nullable=True),
        sa.Column("is_transient", sa.Boolean(), nullable=False),
        sa.Column("group_id", sa.String(), nullable=False),
        sa.Column(
            "value_type",
            sa.Enum("continuous", "categorical", name="valuetype"),
            nullable=True,
        ),
        sa.Column("allowed_values", sa.JSON(), nullable=True),
        sa.Column("dataset_metadata", sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["feature_type_name"],
            ["dimension_type.name"],
            name="fk_dataset_feature_type_name_dimension_type",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["sample_type_name"],
            ["dimension_type.name"],
            name="fk_dataset_sample_type_name_dimension_type",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["group_id"], ["group.id"], name="fk_dataset_group_id_group"
        ),
        sa.ForeignKeyConstraint(
            ["data_type"],
            ["data_type.data_type"],
            name="fk_dataset_data_type_data_type",
        ),
        sa.CheckConstraint(
            "NOT((value_type == 'categorical' AND allowed_values == "
            "null"
            ") OR (value_type == 'continuous' AND allowed_values != "
            "null"
            ") OR (value_type IS NULL AND allowed_values != "
            "null"
            "))",
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
        sa.UniqueConstraint("data_type", "priority", name="_data_type_priority_uc"),
    )
    # list out columns names so order stays consistent
    all_current_datasets = conn.execute(
        text(
            "select id, name, units, feature_type, sample_type, is_transient, group_id, value_type, allowed_values, dataset_metadata, data_type, priority, taiga_id from dataset"
        )
    ).fetchall()
    dataset_inserts = [
        {
            "id": dataset_tuple[0],
            "name": dataset_tuple[1],
            "units": dataset_tuple[2],
            "feature_type_name": dataset_tuple[3],
            "sample_type_name": dataset_tuple[4],
            "is_transient": dataset_tuple[5],
            "group_id": dataset_tuple[6],
            "value_type": dataset_tuple[7],
            "allowed_values": json.loads(dataset_tuple[8])
            if dataset_tuple[8] is not None
            else None,
            "dataset_metadata": json.loads(dataset_tuple[9])
            if dataset_tuple[9] is not None
            else None,
            "data_type": dataset_tuple[10],
            "priority": dataset_tuple[11],
            "taiga_id": dataset_tuple[12],
        }
        for dataset_tuple in all_current_datasets
    ]
    op.bulk_insert(dataset_copy, dataset_inserts)

    op.drop_table("dataset")
    op.rename_table("dataset_copy", "dataset")

    op.drop_table("sample_type")
    op.drop_table("feature_type")

    dimension_copy = op.create_table(
        "dimension_copy",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("dataset_id", sa.String(), nullable=False),
        sa.Column("given_id", sa.String(), nullable=False),
        sa.Column("dataset_dimension_type", sa.String(), nullable=False),
        sa.Column("subtype", sa.String(), nullable=False),
        sa.Column(
            "annotation_type",
            sa.Enum(
                "continuous", "categorical", "binary", "text", name="annotationtype"
            ),
            nullable=True,
        ),
        sa.Column("index", sa.Integer(), nullable=True),
        sa.Column("feature_label", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["dataset_id"], ["dataset.id"], ondelete="CASCADE"),
        sa.CheckConstraint(
            "((subtype == 'dimension_annotation_metadata' AND 'index' IS NULL) OR NOT(subtype == 'dataset_sample' AND 'index' IS NULL) OR NOT(subtype == 'dataset_feature' AND 'index' IS NULL))",
            name="ck_index_with_dim_subtype",
        ),
        sa.CheckConstraint(
            "(subtype == 'dataset_feature' AND annotation_type IS NULL) OR (subtype == 'dataset_sample' AND annotation_type IS NULL) OR (subtype == 'dimension_annotation_metadata' AND NOT(annotation_type IS NULL))",
            name="ck_annotation_type_with_dim_subtype",
        ),
        sa.UniqueConstraint("given_id", "dataset_id", name="_given_id_dataset_id_uc"),
    )
    op.create_index(
        "idx_dataset_id_given_id",
        "dimension_copy",
        ["dataset_id", "given_id"],
        unique=False,
    )
    all_current_dimensions = conn.execute(
        text(
            "select id, dataset_id, name, dataset_dimension_type, subtype, annotation_type, 'index', feature_label from dimension"
        )
    ).fetchall()
    dimension_inserts = [
        {
            "id": dimension_tuple[0],
            "dataset_id": dimension_tuple[1],
            "given_id": dimension_tuple[2],
            "dataset_dimension_type": dimension_tuple[3],
            "subtype": "dimension_annotation_metadata"
            if (dimension_tuple[4] == "feature_annotation_metadata")
            or (dimension_tuple[4] == "sample_annotation_metadata")
            else dimension_tuple[4],
            "annotation_type": dimension_tuple[5],
            "index": dimension_tuple[6],
            "feature_label": dimension_tuple[7],
        }
        for dimension_tuple in all_current_dimensions
    ]
    op.bulk_insert(dimension_copy, dimension_inserts)

    op.drop_table("dimension")
    op.rename_table("dimension_copy", "dimension")

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    conn = op.get_bind()

    with op.batch_alter_table("dimension", schema=None) as batch_op:
        batch_op.drop_constraint("ck_index_with_dim_subtype", type_="check")
        batch_op.drop_constraint("ck_annotation_type_with_dim_subtype", type_="check")
        batch_op.drop_constraint("_given_id_dataset_id_uc", type_="unique")
        batch_op.drop_index("idx_dataset_id_given_id")

        batch_op.alter_column("given_id", new_column_name="name")

    op.create_index(
        "idx_dataset_id_name", "dimension", ["dataset_id", "name"], unique=False
    )
    conn.execute(
        text(
            "update dimension set subtype='feature_annotation_metadata' from (select name from dimension_type where axis='feature') as DT where DT.name = dimension.dataset_dimension_type and dimension.subtype='dimension_annotation_metadata'"
        )
    )
    conn.execute(
        text(
            "update dimension set subtype='sample_annotation_metadata' from (select name from dimension_type where axis='sample') as DT where DT.name = dimension.dataset_dimension_type and dimension.subtype='dimension_annotation_metadata'"
        )
    )
    # SQLite doesn't support JOINS with UPDATE
    # conn.execute("update D set D.subtype = 'feature_annotation_metadata' from dimension as D inner join dimension_type as DT on D.dataset_dimension_type = DT.name where DT.axis='feature' and D.subtype='dimension_annotation_metadata'")

    with op.batch_alter_table("dataset", schema=None) as batch_op:
        batch_op.drop_constraint(
            batch_op.f("fk_dataset_feature_type_name_dimension_type"),
            type_="foreignkey",
        )
        batch_op.drop_constraint(
            batch_op.f("fk_dataset_sample_type_name_dimension_type"), type_="foreignkey"
        )

        batch_op.drop_constraint(
            "ck_feature_type_sample_type_names_not_null", type_="check"
        )
        batch_op.drop_constraint("ck_diff_sample_type_and_feature_type", type_="check")

        batch_op.alter_column("feature_type_name", new_column_name="feature_type")
        batch_op.alter_column("sample_type_name", new_column_name="sample_type")

        batch_op.create_foreign_key(
            "fk_dataset_feature_type_feature_type",
            "feature_type",
            ["feature_type"],
            ["feature_type"],
            ondelete="CASCADE",
        )
        batch_op.create_foreign_key(
            "fk_dataset_sample_type_sample_type",
            "sample_type",
            ["sample_type"],
            ["sample_type"],
            ondelete="CASCADE",
        )

    sample_type = op.create_table(
        "sample_type",
        sa.Column("sample_type", sa.VARCHAR(), nullable=False),
        sa.Column("id_column", sa.VARCHAR(), nullable=False),
        sa.Column("dataset_id", sa.VARCHAR(), nullable=True),
        sa.ForeignKeyConstraint(
            ["dataset_id"], ["dataset.id"], name="fk_sample_type_dataset_id_dataset"
        ),
        sa.PrimaryKeyConstraint("sample_type"),
    )
    feature_type = op.create_table(
        "feature_type",
        sa.Column("feature_type", sa.VARCHAR(), nullable=False),
        sa.Column("id_column", sa.VARCHAR(), nullable=False),
        sa.Column("dataset_id", sa.VARCHAR(), nullable=True),
        sa.ForeignKeyConstraint(
            ["dataset_id"], ["dataset.id"], name="fk_feature_type_dataset_id_dataset"
        ),
        sa.PrimaryKeyConstraint("feature_type"),
    )
    all_feature_types = conn.execute(
        text(
            "select name, id_column, dataset_id from dimension_type where axis='feature'"
        )
    ).fetchall()
    feature_type_inserts = [
        {
            "feature_type": feature_type_tuple[0],
            "id_column": feature_type_tuple[1],
            "dataset_id": feature_type_tuple[2],
        }
        for feature_type_tuple in all_feature_types
    ]
    op.bulk_insert(feature_type, feature_type_inserts)
    all_sample_types = conn.execute(
        text(
            "select name, id_column, dataset_id from dimension_type where axis='sample'"
        )
    ).fetchall()
    sample_type_inserts = [
        {
            "sample_type": sample_type_tuple[0],
            "id_column": sample_type_tuple[1],
            "dataset_id": sample_type_tuple[2],
        }
        for sample_type_tuple in all_sample_types
    ]
    op.bulk_insert(sample_type, sample_type_inserts)

    op.drop_table("dimension_type")

    sample_annotation_value = op.create_table(
        "sample_annotation_value",
        sa.Column("id", sa.INTEGER(), nullable=False),
        sa.Column("sample_annotation_id", sa.VARCHAR(), nullable=True),
        sa.Column("sample_id", sa.VARCHAR(), nullable=False),
        sa.Column("value", sa.TEXT(), nullable=True),
        sa.ForeignKeyConstraint(
            ["sample_annotation_id"],
            ["dimension.id"],
            name="fk_sample_annotation_value_sample_annotation_id_dimension",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sample_id", "sample_annotation_id"),
    )
    with op.batch_alter_table("sample_annotation_value", schema=None) as batch_op:
        batch_op.create_index(
            "idx_sample_annotation_id_sample_id",
            ["sample_annotation_id", "sample_id"],
            unique=False,
        )

    feature_annotation_value = op.create_table(
        "feature_annotation_value",
        sa.Column("id", sa.INTEGER(), nullable=False),
        sa.Column("feature_annotation_id", sa.VARCHAR(), nullable=True),
        sa.Column("feature_id", sa.VARCHAR(), nullable=False),
        sa.Column("value", sa.TEXT(), nullable=True),
        sa.ForeignKeyConstraint(
            ["feature_annotation_id"],
            ["dimension.id"],
            name="fk_feature_annotation_value_feature_annotation_id_dimension",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("feature_id", "feature_annotation_id"),
    )
    with op.batch_alter_table("feature_annotation_value", schema=None) as batch_op:
        batch_op.create_index(
            "idx_feature_annotation_id_feature_id",
            ["feature_annotation_id", "feature_id"],
            unique=False,
        )

    all_feature_annotation_values = conn.execute(
        text(
            "select annotation_value.id, dimension_annotation_id, dimension_given_id, value from annotation_value inner join dimension on annotation_value.dimension_annotation_id=dimension.id where dimension.subtype='feature_annotation_metadata'"
        )
    ).fetchall()
    feature_annotation_value_inserts = [
        {
            "feature_annotation_id": feature_annotation_value_tuple[1],
            "feature_id": feature_annotation_value_tuple[2],
            "value": feature_annotation_value_tuple[3],
        }
        for feature_annotation_value_tuple in all_feature_annotation_values
    ]
    op.bulk_insert(feature_annotation_value, feature_annotation_value_inserts)
    all_sample_annotation_values = conn.execute(
        text(
            "select annotation_value.id, dimension_annotation_id, dimension_given_id, value from annotation_value inner join dimension on annotation_value.dimension_annotation_id=dimension.id where dimension.subtype='sample_annotation_metadata'"
        )
    ).fetchall()
    sample_annotation_value_inserts = [
        {
            "sample_annotation_id": sample_annotation_value_tuple[1],
            "sample_id": sample_annotation_value_tuple[2],
            "value": sample_annotation_value_tuple[3],
        }
        for sample_annotation_value_tuple in all_sample_annotation_values
    ]
    op.bulk_insert(sample_annotation_value, sample_annotation_value_inserts)

    with op.batch_alter_table("annotation_value", schema=None) as batch_op:
        batch_op.drop_index("idx_dimension_annotation_id_dimension_given_id")
    op.drop_table("annotation_value")

    # ### end Alembic commands ###
