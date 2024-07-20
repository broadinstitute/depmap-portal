from breadbox.config import Settings
from fastapi import HTTPException


def assert_is_admin_user(user: str, settings: Settings):
    if user not in settings.admin_users:
        raise HTTPException(
            403, "You do not have permission to delete the dimension type."
        )
