from fastapi import Depends, HTTPException, Request

from ..crud import dataset as dataset_crud
from breadbox.db.session import SessionLocalWithUser, SessionWithUser
from breadbox.config import get_settings
from breadbox.schemas.custom_http_exception import DatasetNotFoundError
import os
from breadbox.utils.caching import create_caching_caller


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


def get_cache():
    settings = get_settings()
    return create_caching_caller(settings.redis_host)
