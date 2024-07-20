from flask import session
from . import private_util_functions
from typing import Dict

from depmap.access_control.models import GroupAuthConfig, PUBLIC_ACCESS_GROUP


def get_owner_id_from_group_display_name(group_display_name: str):
    """
    This is a layer of indirection, and this function simply returns the call to another function
    The layer comes from wanting to hide direct access to current_app.__depmap_auth_config in private_util_functions, and just expose what is necessary
    """
    return private_util_functions._get_owner_id_from_group_display_name(
        group_display_name
    )


def set_user_override(user_id):
    """
    Override which user is returned by get_current_user_for_access_control(). Only takes effect if real user is marked as an admin.
    (See is_current_user_an_admin() )
    """
    session["user_override"] = user_id


def is_current_user_an_admin():
    return private_util_functions._get_access_control_obj().is_admin


def get_current_user_for_access_control():
    """
    Webapp code should use this for determining user identity

    Same as get_authenticated_user() except honors the value set by set_user_override() if it has been called.
    :return: The user_id which  should be used for determining which objects we can see in the DB
    """
    ca = private_util_functions._get_access_control_obj()
    return ca.user_id


def get_authenticated_user():
    """
    Ignores any override
    """
    ca = private_util_functions._get_access_control_obj()
    return ca.authenticated_user_id


def get_visible_owner_id_configs(write_access=False) -> Dict[int, GroupAuthConfig]:
    """
    By default returns the groups the current user can see. If write_access is true, then it
    returns the groups which the current user can see and write to.

    :return: the owner_id values that the current user should be allowed to see.
    """
    ca = private_util_functions._get_access_control_obj()
    allowed = ca.allowed
    if write_access:
        # A normal user can upload to all groups they're a member of except the public group.
        # However, admins can upload to the public group as well.
        if not is_current_user_an_admin():
            allowed = dict(allowed)
            del allowed[PUBLIC_ACCESS_GROUP]

    return allowed
