from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    event,
)
from sqlalchemy.ext.declarative import declared_attr

# Note "with_loader_criteria" is defined in SQLAlchemy in a way that's confusing to type checkers
from sqlalchemy.orm import (
    relationship,
    Session,
    with_loader_criteria,  # pyright: ignore
)

from ..db.base_class import Base, UUIDMixin

from typing import Any, TypeVar, Type, TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.sql.type_api import TypeEngine
    from breadbox.models.dataset import Dataset

    T = TypeVar("T")

    class Enum(TypeEngine[T]):
        def __init__(self, enum: Type[T], **kwargs: Any) -> None:
            ...


else:
    from sqlalchemy import Enum

import enum


from ..schemas.group import AccessType


class Group(Base, UUIDMixin):
    __tablename__ = "group"
    name = Column(String, nullable=False, unique=True)

    group_entries = relationship("GroupEntry", back_populates="group", uselist=True)
    datasets = relationship("Dataset", back_populates="group", uselist=True)


class GroupEntry(Base, UUIDMixin):
    __tablename__ = "group_entry"
    # explicit/composite unique constraint where email can't be duplicate if in same group
    __table_args__ = (UniqueConstraint("email", "group_id"),)

    access_type = Column(Enum(AccessType), nullable=False)
    email = Column(String)
    exact_match = Column(Boolean, default=True)

    group_id = Column(String, ForeignKey("group.id"), nullable=False)

    group = relationship(Group, back_populates="group_entries")


class GroupMixin:
    """
    Mixin that identifies a class as having access controls.
    This is used by a global filter to avoid accidental leakage of private data.
    """

    # NOTE: pyright is not good at handling declared_attr fields, so some type-ignoring is required.
    # See: https://github.com/dropbox/sqlalchemy-stubs/issues/97 (issue has been open for 5 years)
    @declared_attr
    def group_id(cls) -> str:
        return Column(String, ForeignKey("group.id"), nullable=False)  # pyright: ignore

    @declared_attr
    def group(cls) -> Group:
        return relationship(Group, foreign_keys=[cls.group_id])  # pyright: ignore


@event.listens_for(Session, "do_orm_execute")
def _add_filtering_criteria(execute_state):
    """Intercept all ORM queries. Add with_loader_criteria options to all
    of them.

    This option applies to SELECT queries and adds a global WHERE criteria
    (or as appropriate ON CLAUSE criteria for join targets)
    to all objects of a certain class or superclass.
    """

    # These filters are limited to "is_select" (readonly) partly because the filters seem
    # to create difficult-to-debug problems with writes
    # Similarly, once an entity is loaded, it's relationships and columns should be accessible
    # so we don't want to apply these filters on "is_column_load" or "is_relationship_load".
    if (
        execute_state.is_select
        and not execute_state.is_column_load
        and not execute_state.is_relationship_load
    ):
        filter_group_ids = execute_state.execution_options.get("filter_group_ids", [])
        execute_state.statement = execute_state.statement.options(
            with_loader_criteria(
                GroupMixin,
                lambda cls: cls.group_id.in_(filter_group_ids),
                include_aliases=True,
            )
        )
