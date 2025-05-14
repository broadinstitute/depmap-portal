from .router import router
from breadbox.io import kv_store
from typing import Annotated
from fastapi import APIRouter, Body, Depends, HTTPException
from breadbox.api.dependencies import (
    get_user,
    get_user_settings_db_path,
)
import json

# Methods for getting/setting values in Content-addressable-storage (CAS)
@router.get(
    "/user/settings", operation_id="get_user_settings",
)
def get_user_settings(
    user_settings_db_path: Annotated[str, Depends(get_user_settings_db_path)],
    user: Annotated[str, Depends(get_user)],
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
    "/user/settings", operation_id="set_user_settings",
)
def set_user_settings(
    value: dict,
    user_settings_db_path: Annotated[str, Depends(get_user_settings_db_path)],
    user: Annotated[str, Depends(get_user)],
):
    value_bytes = json.dumps(value).encode("utf-8")
    kv_store.set_value(user_settings_db_path, user, value_bytes)
    return value
