from fastapi import APIRouter, Depends, Form, HTTPException
import pandas as pd
from ..config import Settings, get_settings
from .dependencies import get_db_with_user, get_user
from typing import List
from logging import getLogger

from breadbox.db.session import SessionWithUser
from ..crud import data_type as data_type_crud
from ..crud import dataset as dataset_crud
from ..schemas.data_type import DataType
from ..schemas.custom_http_exception import UserError, HTTPError
from ..db.util import transaction

router = APIRouter(prefix="/data_types", tags=["data_types"])
log = getLogger(__name__)


@router.post(
    "/",
    operation_id="add_data_type",
    response_model=DataType,
    response_model_by_alias=False,
    response_model_exclude_none=False,
)
def add_data_type(
    name: str = Form(...),
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
    settings: Settings = Depends(get_settings),
):
    # Check if data type already exists
    if data_type_crud.get_data_type(db, name) is not None:
        raise HTTPException(400, f"Data type {name} already exists!")

    if user not in settings.admin_users:
        raise HTTPException(403)
    with transaction(db):
        data_type = data_type_crud.add_data_type(db, name)

    return DataType(name=data_type.data_type)


@router.get(
    "/",
    operation_id="get_data_types",
    response_model=List[DataType],
    response_model_by_alias=False,
    response_model_exclude_none=False,
)
def get_data_types(db: SessionWithUser = Depends(get_db_with_user)):
    data_types = data_type_crud.get_data_types(db)

    return [DataType(name=data_type.data_type) for data_type in data_types]


@router.delete(
    "/{data_type}", operation_id="remove_data_type",
)
def delete_data_type(
    data_type: str,
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
    settings: Settings = Depends(get_settings),
):
    """Delete a feature type, if the user is an admin."""
    if user not in settings.admin_users:
        raise HTTPException(403)

    data_type_type = data_type_crud.get_data_type(db, data_type)
    if data_type_type is None:
        raise HTTPException(404, "Data type not found")

    with transaction(db):
        if data_type_crud.delete_data_type(db, data_type_type):
            return {"message": f"Deleted {data_type_type.data_type}"}
        else:
            raise UserError(
                f"Datasets with datatype {data_type} exists! Must delete datasets with the data type first."
            )


@router.get(
    "/priorities", operation_id="get_data_type_valid_priorities",
)
def get_data_type_valid_priorities(db: SessionWithUser = Depends(get_db_with_user)):
    # Get data types that have been assigned to a dataset and therefore
    # might have priorities in use.
    used_priorities_by_data_type = dataset_crud.get_dataset_data_type_priorities(db)

    # Get all data types, even if they have not been assigned to a dataset.
    # This is particularly important for loading the preset data_type options
    # into the UI, because these presets are loaded independently of datasets
    # in the depmap_loader.
    all_data_types = data_type_crud.get_data_types(db)
    all_data_type_names = [dt.data_type for dt in all_data_types]

    # Any data type that has not been added to a dataset will just have an
    # empty list as its value, because all priorities are available for future
    # assignment.
    all_data_type_priorities = {}
    for data_type_name in all_data_type_names:
        if data_type_name in used_priorities_by_data_type.keys():
            all_data_type_priorities[data_type_name] = used_priorities_by_data_type[
                data_type_name
            ]
        else:
            all_data_type_priorities[data_type_name] = []

    return pd.Series(all_data_type_priorities)
