from typing import List, Optional

from breadbox.db.session import SessionWithUser
from ..models.data_type import DataType
from ..models.dataset import Dataset


def get_data_types(db: SessionWithUser) -> List[DataType]:
    return db.query(DataType).all()


def get_data_type(db: SessionWithUser, name: str) -> Optional[DataType]:
    return db.query(DataType).filter_by(data_type=name).one_or_none()


def add_data_type(db: SessionWithUser, name: str) -> DataType:
    data_type = DataType(data_type=name)
    db.add(data_type)
    return data_type


def delete_data_type(db: SessionWithUser, data_type: DataType):
    if db.query(Dataset).filter(Dataset.data_type == data_type.data_type).count() > 0:
        return False
    db.delete(data_type)
    return True
