from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from breadbox.db.base_class import Base


class DataType(Base):
    __tablename__ = "data_type"

    data_type: Mapped[str] = mapped_column(String, primary_key=True)
