from .router import router
from breadbox.schemas.cas import CASKey, CASValue
from breadbox.io import cas
import os.path
from typing import Annotated
from fastapi import APIRouter, Body, Depends, HTTPException
from breadbox.api.dependencies import get_db_with_user, get_cas_db_path

# Methods for getting/setting values in Content-addressable-storage (CAS)
@router.get(
    "/cas/{key}", operation_id="get_cas_value", response_model=CASValue,
)
def get_cas_value(key: str, cas_db_path: Annotated[str, Depends(get_cas_db_path)]):
    value = cas.get_value(cas_db_path, key)
    if value is None:
        raise HTTPException(status_code=404)
    return CASValue(value=value)


@router.post(
    "/cas", operation_id="set_cas_value", response_model=CASKey,
)
def set_cas_value(
    value: CASValue, cas_db_path: Annotated[str, Depends(get_cas_db_path)]
):
    key = cas.set_value(cas_db_path, value.value)
    return CASKey(key=key)
