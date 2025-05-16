import uuid

from sqlalchemy import Column, String, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Mapped

# It has been a pain point encountering unnamed constraints when migrating since you can't drop unnamed constraints. These conventions will be used when the sqlalchemy model has constraints that are unnamed
convention = {
    "ix": "ix_%(column_0_label)s",  # index naming
    "uq": "uq_%(table_name)s_%(column_0_name)s",  # unique constraint naming
    "ck": "ck_%(table_name)s_%(column_0_name)s_%(column_1_name)s",  # check constraint naming
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",  # FK constraint naming
    "pk": "pk_%(table_name)s",  # primary key naming
}

metadata_obj = MetaData(naming_convention=convention)
Base = declarative_base(metadata=metadata_obj)


class UUIDMixin:
    id: Mapped[str] = Column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
