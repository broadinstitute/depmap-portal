from typing import Union
from uuid import UUID

from fastapi import Depends, HTTPException, Request

from ..crud import dataset as dataset_crud
from breadbox.db.session import SessionLocalWithUser, SessionWithUser
from breadbox.config import get_settings
import os


def get_db_with_user(request: Request):
    user = get_user(request)
    db = SessionLocalWithUser(user)
    try:
        yield db
    finally:
        db.close()


def get_legacy_cas_bucket():
    settings = get_settings()
    return settings.LEGACY_CAS_BUCKET


def get_cas_db_path():
    settings = get_settings()
    return os.path.join(settings.filestore_location, "cas.sqlite3")


def get_user_settings_db_path():
    settings = get_settings()
    return os.path.join(settings.filestore_location, "user_settings.sqlite3")


def get_user(request: Request) -> str:
    # try to get from the oauth email address
    user = request.headers.get("X-Forwarded-Email")

    # if we don't have that try oauth user name
    if user is None:
        user = request.headers.get("X-Forwarded-User")

    if user is None:
        settings = get_settings()
        # Only use default user if using dev instance of breadbox
        user = settings.default_user if settings.breadbox_env == "dev" else None

    if user is None:
        raise HTTPException(401, "User cannot be null")

    return user


def get_dataset(
    dataset_id: Union[UUID, str],
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
):
    dataset = dataset_crud.get_dataset(db, user, dataset_id)

    if dataset is None:
        raise HTTPException(404, detail=f"Dataset '{dataset_id}' not found")
    return dataset
