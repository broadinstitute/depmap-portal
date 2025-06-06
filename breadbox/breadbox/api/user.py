from fastapi import APIRouter, Depends
from .dependencies import get_user as get_user_dep
from breadbox.io import kv_store
from typing import Annotated
from fastapi import APIRouter, Body, Depends, HTTPException
from breadbox.api.dependencies import (
    get_user as get_user_dep,
    get_user_settings_db_path,
)
import json

router = APIRouter(prefix="/user", tags=["user"])


@router.get("/", operation_id="get_user")
def get_user(user: str = Depends(get_user_dep)):
    return user


# Methods for getting/setting values in Content-addressable-storage (CAS)
@router.get(
    "/settings", operation_id="get_user_settings",
)
def get_user_settings(
    user_settings_db_path: Annotated[str, Depends(get_user_settings_db_path)],
    user: Annotated[str, Depends(get_user_dep)],
):
    value = kv_store.get_value(user_settings_db_path, user)

    if value is None:
        parsed_value = {}
    else:
        # parsing it is not really necessary on return, but I thought this could be
        # useful to sanity check that the data is valid formed JSON before returning
        # to the client. However, we could probably just return the string to the client
        # with no parsing and it'd be fine.
        parsed_value = json.loads(value)

    return parsed_value


@router.post(
    "/settings", operation_id="set_user_settings",
)
def set_user_settings(
    value: dict,
    user_settings_db_path: Annotated[str, Depends(get_user_settings_db_path)],
    user: Annotated[str, Depends(get_user_dep)],
):
    value_bytes = json.dumps(value).encode("utf-8")
    kv_store.set_value(user_settings_db_path, user, value_bytes)
    return value
