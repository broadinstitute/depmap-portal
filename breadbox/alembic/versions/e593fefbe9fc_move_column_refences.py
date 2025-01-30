"""move column refences

Revision ID: e593fefbe9fc
Revises: 52a899219efc
Create Date: 2025-01-14 09:38:54.610116

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e593fefbe9fc"
down_revision = "52a899219efc"
branch_labels = None
depends_on = None


def upgrade():
    # add references data type column onto dimension
    with op.batch_alter_table("dimension", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("references_dimension_type_name", sa.String(), nullable=True)
        )
        batch_op.create_foreign_key(
            batch_op.f("fk_dimension_references_dimension_type_name_dimension_type"),
            "dimension_type",
            ["references_dimension_type_name"],
            ["name"],
        )

    # run query to figure out which dimension records need updating
    op.execute(
        "create table tmp_references_to_copy as select dt_from.name datatype_name, dr.column column_name, from_col.id dimension_id, dt_to.name references_dimension_type_name from dimension_type dt_from join dataset dt_from_meta on dt_from_meta.id = dt_from.dataset_id join dataset_reference dr on dr.dataset_id = dt_from.dataset_id join dataset dt_to_meta on dt_to_meta.id = dr.referenced_dataset_id join dimension_type dt_to on dt_to.dataset_id = dt_to_meta.id join dimension from_col on (from_col.dataset_id = dt_from_meta.id and from_col.given_id = dr.column)"
    )
    # Do the actual updates
    op.execute(
        "update dimension set references_dimension_type_name = (select references_dimension_type_name from tmp_references_to_copy where id = dimension_id) where exists (select references_dimension_type_name from tmp_references_to_copy where id = dimension_id) "
    )

    # now we can clean up and drop tables
    op.drop_table("tmp_references_to_copy")
    op.drop_table("dataset_reference")

    # save original property_to_index table
    op.rename_table("property_to_index", "old_property_to_index")
    # create new version with dimension_type_name instead of dataset_id
    op.create_table(
        "property_to_index",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("dimension_type_name", sa.String(), nullable=False),
        sa.Column("property", sa.String(), nullable=False),
        sa.Column("group_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ["dimension_type_name"],
            ["dimension_type.name"],
            name=op.f("fk_property_to_index2_dimension_type_name_dimension_type"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["group_id"],
            ["group.id"],
            name=op.f("fk_property_to_index2_group_id_group"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_property_to_index2")),
    )
    # copy rows from old table into new table
    op.execute(
        "insert into property_to_index ('id', 'dimension_type_name', 'property', 'group_id') select pti.id, dt.name, pti.property, pti.group_id from old_property_to_index pti join dataset d on pti.dataset_id = d.id join dimension_type dt on dt.dataset_id = d.id"
    )
    # clean up the old version
    op.drop_table("old_property_to_index")

    # figure out how to update property_to_index
    # op.execute()
    #
    #
    # with op.batch_alter_table('property_to_index', schema=None) as batch_op:
    #     batch_op.add_column(sa.Column('dimension_type_name', sa.String(), nullable=False))
    #     batch_op.drop_constraint('fk_property_to_index_dataset_id_dataset', type_='foreignkey')
    #     batch_op.create_foreign_key(batch_op.f('fk_property_to_index_dimension_type_name_dimension_type'), 'dimension_type', ['dimension_type_name'], ['name'], ondelete='CASCADE')
    #     batch_op.drop_column('dataset_id')
    #

    # drop search index and recreate it. We should add a step to deploy to populate this if it's empty
    op.drop_table("dimension_search_index")
    op.create_table(
        "dimension_search_index",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("property", sa.String(), nullable=False),
        sa.Column("value", sa.String(), nullable=True),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("dimension_type_name", sa.String(), nullable=False),
        sa.Column("dimension_given_id", sa.String(), nullable=False),
        sa.Column("group_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ["dimension_type_name"],
            ["dimension_type.name"],
            name=op.f("fk_dimension_search_index_dimension_type_name_dimension_type"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["group_id"],
            ["group.id"],
            name=op.f("fk_dimension_search_index_group_id_group"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_dimension_search_index")),
    )
    with op.batch_alter_table("dimension_search_index", schema=None) as batch_op:
        batch_op.create_index("idx_dim_search_index_perf_1", ["value"], unique=False)
        batch_op.create_index(
            "idx_dim_search_index_perf_2",
            ["dimension_type_name", "value"],
            unique=False,
        )
        batch_op.create_index(
            "idx_dim_search_index_perf_4",
            ["dimension_given_id", "dimension_type_name", "value"],
            unique=False,
        )

    # ### end Alembic commands ###


def downgrade():
    raise NotImplementedError()
