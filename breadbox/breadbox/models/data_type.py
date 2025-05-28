from sqlalchemy import (
    Column,
    String,
)
from sqlalchemy.orm import Mapped

from breadbox.db.base_class import Base


class DataType(Base):
    __tablename__ = "data_type"

    data_type: Mapped[str] = Column(String, primary_key=True)
