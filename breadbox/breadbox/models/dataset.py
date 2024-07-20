import uuid
from sqlalchemy import (
    Column,
    ForeignKey,
    CheckConstraint,
    String,
    Integer,
    Index,
    UniqueConstraint,
    Boolean,
    JSON,
    Text,
    DateTime,
)
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from breadbox.schemas.dataset import ColumnMetadata

# from sqlalchemy.orm.decl_api import declared_attr
from breadbox.db.base_class import Base, UUIDMixin
from breadbox.models.group import Group, GroupMixin, ReferencedGroupMixin
from breadbox.models.data_type import DataType
from typing import Any, TypeVar, Type, TYPE_CHECKING
from ..schemas.dataset import ValueType, AnnotationType


if TYPE_CHECKING:
    from sqlalchemy.sql.type_api import TypeEngine

    T = TypeVar("T")

    class Enum(TypeEngine[T]):
        def __init__(self, enum: Type[T], **kwargs: Any) -> None:
            ...


else:
    from sqlalchemy import Enum

import enum


class DimensionType(Base):
    __tablename__ = "dimension_type"
    __table_args__ = (
        CheckConstraint("(axis == 'feature') OR (axis == 'sample')", name="ck_axis"),
    )

    name = Column(String, nullable=False, primary_key=True)
    id_column = Column(String, nullable=False)  # The column name in the file
    axis = Column(String, nullable=False)  # "feature" or "sample" type
    dataset_id = Column(String, ForeignKey("dataset.id"))  # One to One relationship
    dataset = relationship(
        "Dataset",
        backref=backref("dimension_type", uselist=False),
        foreign_keys=[dataset_id],
        lazy="select",
        cascade="all, delete",
    )


class Dataset(Base, UUIDMixin, GroupMixin):
    __tablename__ = "dataset"
    __table_args__ = (
        CheckConstraint(
            "format == 'tabular_dataset' OR format ==  'matrix_dataset'",
            name="dataset_format",
        ),
    )

    name = Column(String, nullable=False)
    format = Column(String, nullable=False)
    data_type = Column(String, ForeignKey(DataType.data_type), nullable=False)
    is_transient = Column(Boolean, nullable=False)

    priority = Column(Integer, nullable=True)
    taiga_id = Column(String, nullable=True)

    dataset_metadata = Column(JSON, nullable=True)  # jsonified dictionary
    # DB calculates timestamp itself
    upload_date = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # When row is updated, sqlalchemy inserts a new timestamp. DB calculates timestamp itself
    update_date = Column(
        DateTime(timezone=True),
        onupdate=func.now(),
        server_default=func.now(),
        nullable=False,
    )
    md5_hash = Column(String(32))  # NOTE: MD5 hashes are 128bits -> 32 hex digits

    __mapper_args__ = {"polymorphic_on": format, "polymorphic_identity": "dataset"}


class TabularDataset(Dataset):
    __tablename__ = "tabular_dataset"

    # Cascade deletes so when Dataset row deleted, corresponding TabularDataset also deleted
    id = Column(
        String(36),
        ForeignKey("dataset.id", ondelete="CASCADE"),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    index_type_name = Column(
        String, ForeignKey("dimension_type.name", ondelete="CASCADE"), nullable=False
    )
    __mapper_args__ = {"polymorphic_identity": "tabular_dataset"}

    @property
    def columns_metadata(self):
        # construct the columns metadata as a dict for purpose of the pydantic serialization.
        # I'm not sure that this is the best way to approach this, but computed properties are
        # the smallest change I can think of to accommodate how things work already.

        # first populate a map so we can look up the data type names per column
        column_refs = {}
        for column_ref in self.dataset_references:
            column_refs[
                column_ref.column
            ] = column_ref.referenced_dataset.index_type_name
        columns = {}
        for dimension in self.dimensions:
            columns[dimension.given_id] = ColumnMetadata(
                units=dimension.units,
                col_type=dimension.annotation_type,
                references=column_refs.get(dimension.given_id),
            )
        return columns


class MatrixDataset(Dataset):

    __tablename__ = "matrix_dataset"
    __table_args__ = (
        CheckConstraint(
            "NOT((value_type == 'categorical' AND allowed_values == 'null') OR (value_type == 'continuous' AND allowed_values != 'null') OR (value_type IS NULL AND allowed_values != 'null'))",
            name="ck_allowed_values_for_categorical_value_type",
        ),
        CheckConstraint(
            "NOT(feature_type_name IS NULL AND sample_type_name IS NULL)",
            name="ck_feature_type_sample_type_names_not_null",
        ),  # constraint for metadata datasets
        CheckConstraint(
            "feature_type_name != sample_type_name",
            name="ck_diff_sample_type_and_feature_type",
        ),
    )
    # Cascade deletes so when Dataset row deleted, corresponding MatrixDataset also deleted
    id = Column(
        String(36),
        ForeignKey("dataset.id", ondelete="CASCADE"),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    units = Column(
        String, nullable=False
    )  # TODO: Limit to conitnuous value types later
    feature_type_name = Column(
        String, ForeignKey("dimension_type.name", ondelete="CASCADE"), nullable=True,
    )
    sample_type_name = Column(
        String, ForeignKey("dimension_type.name", ondelete="CASCADE"), nullable=False
    )
    feature_type = relationship("DimensionType", foreign_keys=[feature_type_name])
    sample_type = relationship("DimensionType", foreign_keys=[sample_type_name])
    value_type = Column(Enum(ValueType), nullable=False)
    allowed_values = Column(JSON, nullable=True)  # jsonfied string of a list_strings

    __mapper_args__ = {"polymorphic_identity": "matrix_dataset"}


class Dimension(Base, UUIDMixin, GroupMixin):
    __tablename__ = "dimension"
    __table_args__ = (
        Index("idx_dataset_id_given_id", "dataset_id", "given_id"),
        UniqueConstraint("given_id", "dataset_id", name="_given_id_dataset_id_uc"),
        CheckConstraint(
            "((subtype == 'tabular_column' AND 'index' IS NULL) OR NOT(subtype == 'dataset_sample' AND 'index' IS NULL) OR NOT(subtype == 'dataset_feature' AND 'index' IS NULL))",
            name="ck_index_with_dim_subtype",
        ),
        CheckConstraint(
            "(subtype == 'dataset_feature' AND annotation_type IS NULL) OR (subtype == 'dataset_sample' AND annotation_type IS NULL) OR (subtype == 'tabular_column' AND NOT(annotation_type IS NULL))",
            name="ck_annotation_type_with_dim_subtype",
        ),
        CheckConstraint(
            "NOT(NOT(units is NULL) AND subtype!='tabular_column')",
            name="units_for_tabular_subtype",
        ),
    )
    dataset_id = Column(
        String, ForeignKey("dataset.id", ondelete="CASCADE"), nullable=False
    )
    dataset = relationship(
        Dataset, backref=backref("dimensions", cascade="all, delete-orphan")
    )
    given_id = Column(
        String, nullable=False
    )  # name of series (column or index name of the dataset)
    dataset_dimension_type = Column(
        String, nullable=True
    )  # feature type or sample type name, only used by vector catalog
    subtype = Column(String, nullable=False)  # discriminator column

    # NOTE: The type stubs package 'sqlalchemy-stubs' with mypy plugin 'sqlmypy' does not support SQLAlchemy's declared attributes decorator (and the module it's imported from) and this is still an open issue (https://github.com/dropbox/sqlalchemy-stubs/issues/97).
    # We are using the SQLAlchemy single table inheritance model for potential performance benefits and in doing so, fields with the same name in different subtables need to use this decorator.
    # Although SQLAlchemy's first-party mypy plugin packaged at sqlalchemy2-stubs has support for the declared attributes decorator, it seems to require more explicit type mappings with SQLAlchemy models which the original sqlalchemy-stubs package could automatically infer.
    # We have decided to work around the issue by sticking with the sqlmypy plugin using sqlalchemy-stubs and moving those fields to the parent table with constraints on its values
    index = Column(Integer, nullable=True)

    __mapper_args__ = {"polymorphic_on": subtype, "polymorphic_identity": "dimension"}


class DatasetFeature(Dimension):
    # @declared_attr
    # def index(cls) -> Column[Integer]:
    #     "0-indexed column number in hdf5 file"
    #     return Dimension.__table__.c.get("index", Column(Integer))

    __mapper_args__ = {"polymorphic_identity": "dataset_feature"}


class DatasetSample(Dimension):
    # @declared_attr
    # def index(cls) -> Column[Integer]:
    #     "0-indexed column number in hdf5 file"
    #     return Dimension.__table__.c.get("index", Column(Integer))

    __mapper_args__ = {"polymorphic_identity": "dataset_sample"}


class TabularColumn(Dimension):
    __mapper_args__ = {"polymorphic_identity": "tabular_column"}

    annotation_type = Column(
        Enum(AnnotationType)
    )  # annotation type (i.e. text, categorical)
    units = Column(String, nullable=True)

    tabular_cells = relationship(
        "TabularCell",
        back_populates="tabular_column",
        cascade="all, delete",
        passive_deletes=True,
        uselist=True,
    )


class TabularCell(Base, GroupMixin):
    """
    Value for each cell in a tabular column
    """

    __tablename__ = "tabular_cell"
    __table_args__ = (
        Index(
            "idx_tabular_column_id_dimension_given_id",
            "tabular_column_id",
            "dimension_given_id",
        ),
        UniqueConstraint("dimension_given_id", "tabular_column_id"),
    )
    id = Column(Integer, primary_key=True, autoincrement=True)
    tabular_column_id = Column(String, ForeignKey("dimension.id", ondelete="CASCADE"))
    tabular_column = relationship(
        "TabularColumn",
        primaryjoin="and_(TabularCell.tabular_column_id==TabularColumn.id)",
        back_populates="tabular_cells",
        lazy="select",
    )
    dimension_given_id = Column(String, nullable=False)
    value = Column(Text)


class DimensionSearchIndex(Base, UUIDMixin, GroupMixin):
    __tablename__ = "dimension_search_index"

    __table_args__ = (
        Index("idx_dimension_search_index_dimension_id", "dimension_id",),
    )

    dimension_id = Column(
        String, ForeignKey("dimension.id", ondelete="CASCADE"), nullable=False
    )
    dimension = relationship(
        Dimension,
        backref=backref(
            "dimension_search_indexes",
            cascade="all, delete-orphan",
            passive_deletes=True,
        ),
    )
    dimension_given_id = Column(String, nullable=False)
    label = Column(String, nullable=False)
    property = Column(String, nullable=False)
    value = Column(String, nullable=True)
    priority = Column(Integer, nullable=True)
    axis = Column(String, nullable=False)
    type_name = Column(String, nullable=False)


class DatasetReference(Base, UUIDMixin, GroupMixin, ReferencedGroupMixin):
    __tablename__ = "dataset_reference"

    dataset_id = Column(
        String, ForeignKey("dataset.id", ondelete="CASCADE"), nullable=False
    )
    dataset = relationship(
        Dataset,
        foreign_keys=[dataset_id],
        backref=backref("dataset_references", cascade="all, delete-orphan"),
    )
    column = Column(String, nullable=False)
    referenced_dataset_id = Column(
        String, ForeignKey("dataset.id", ondelete="CASCADE"), nullable=False
    )
    referenced_dataset = relationship(
        Dataset,
        foreign_keys=[referenced_dataset_id],
        backref=backref("referred_by_dataset", cascade="all, delete-orphan"),
    )


class PropertyToIndex(Base, UUIDMixin, GroupMixin):
    __tablename__ = "property_to_index"

    dataset_id = Column(
        String, ForeignKey("dataset.id", ondelete="CASCADE"), nullable=False
    )
    dataset = relationship(
        Dataset, backref=backref("properties_to_index", cascade="all, delete-orphan"),
    )
    property = Column(String, nullable=False)


class CatalogNode(Base):
    """
    Needs to be created right after a new dataset with features are added
    """

    __tablename__ = "catalog_node"
    __table_args__ = (
        Index("idx_dataset_id_dimension_id", "dataset_id", "dimension_id"),
        Index("idx_catalog_node_dimension_id", "dimension_id"),
    )
    id = Column(Integer, primary_key=True, autoincrement=True)
    dataset_id = Column(String)
    dataset = relationship(
        Dataset,
        foreign_keys=[dataset_id],
        primaryjoin="Dataset.id == CatalogNode.dataset_id",
        backref=backref(
            "catalog_nodes", cascade="all, delete-orphan", passive_deletes=True,
        ),
    )
    dimension_id = Column(String)
    dimension = relationship(
        Dimension,
        foreign_keys=[dimension_id],
        primaryjoin="Dimension.id == CatalogNode.dimension_id",
        backref=backref(
            "catalog_nodes", cascade="all, delete-orphan", passive_deletes=True
        ),
    )
    priority = Column(Integer)
    parent_id = Column(Integer)
    parent = relationship(
        "CatalogNode",
        foreign_keys=[parent_id],
        primaryjoin="CatalogNode.id == CatalogNode.parent_id",
        remote_side=id,
        backref=backref("children", lazy="select"),
    )
    label = Column(String, nullable=False)  # is the name of column/index in dataset
    is_continuous = Column(Boolean)
    is_categorical = Column(Boolean)
    is_binary = Column(Boolean)
    is_text = Column(Boolean)
