from .router import router
from breadbox.schemas.cas import CASKey, CASValue
from breadbox.io import cas
from typing import Annotated, Optional
from fastapi import APIRouter, Body, Depends, HTTPException
from breadbox.api.dependencies import (
    get_db_with_user,
    get_cas_db_path,
    get_legacy_cas_bucket,
)

# Methods for getting/setting values in Content-addressable-storage (CAS)
@router.get(
    "/cas/{key}", operation_id="get_cas_value", response_model=CASValue,
)
def get_cas_value(
    key: str,
    cas_db_path: Annotated[str, Depends(get_cas_db_path)],
    legacy_cas_bucket: Annotated[Optional[str], Depends(get_legacy_cas_bucket)],
):
    value = cas.get_value(cas_db_path, key)

    if legacy_cas_bucket is not None and value is None:
        value = cas.legacy_get_value(legacy_cas_bucket, key)

    if value is None:
        raise HTTPException(status_code=404)
    return CASValue(value=value)


@router.post(
    "/cas", operation_id="set_cas_value", response_model=CASKey,
)
def set_cas_value(
    value: CASValue,
    cas_db_path: Annotated[str, Depends(get_cas_db_path)],
    legacy_cas_bucket: Annotated[Optional[str], Depends(get_legacy_cas_bucket)],
):
    key = cas.set_value(cas_db_path, value.value)

    if legacy_cas_bucket is not None:
        legacy_key = cas.legacy_set_value(legacy_cas_bucket, value.value)
        assert legacy_key == key

    return CASKey(key=key)
