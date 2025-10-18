from sqlalchemy import String
try:
    from sqlalchemy.orm import Mapped, mapped_column
except ImportError:
    # For older versions of SQLAlchemy that don't have these types
    from typing import Any
    Mapped = Any
    mapped_column = lambda *args, **kwargs: args[0]

from breadbox.db.base_class import Base


class DataType(Base):
    __tablename__ = "data_type"

    data_type: Mapped[str] = mapped_column(String, primary_key=True)
