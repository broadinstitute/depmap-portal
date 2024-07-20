from sqlalchemy import (
    Column,
    String,
)

from breadbox.db.base_class import Base


class DataType(Base):
    __tablename__ = "data_type"

    data_type = Column(String, primary_key=True)
