from typing import Optional, Dict, List
from flask import current_app, session
from depmap.access_control.models import (
    AuthorizationConfig,
    PUBLIC_ACCESS_GROUP,
    PUBLIC_ACCESS_GROUP_AUTH_CONFIG,
)
import flask
from depmap.access_control.models import CurrentAuthorizations, GroupAuthConfig


def _setup_current_authorizations(
    user_id: str,
    is_admin: bool,
    user_id_override: str = None,
    owner_ids_override: Dict[int, GroupAuthConfig] = None,
) -> CurrentAuthorizations:
    """
    :param user_is: authenticated user
    :param is_admin: authenticated user is admin
    :param user_id_override: may be provided with or without owner_ids_override. used for owner idea override such as the session override, assume_user, and all_records_visible
    :param owner_ids_override: optional even when user_id_override is provided.
        this is only used when you want to override with owner_ids there are different from the owner_ids that the user_id_override would normally have
        i.e., only used in all_records_visible to allow access to all groups
    """
    owner_ids = current_app.__depmap_auth_config.get_allowed_owner_ids(user_id)

    if user_id_override and not owner_ids_override:
        owner_ids_override = current_app.__depmap_auth_config.get_allowed_owner_ids(
            user_id_override
        )

    ca = CurrentAuthorizations(
        user_id,
        owner_ids,
        is_admin,
        user_id_override=user_id_override,
        allowed_override=owner_ids_override,
    )

    flask.g.__depmap_access_control = ca
    return ca


def _get_access_control_obj() -> CurrentAuthorizations:
    """
    For use within utils only, code outside this module should not call this
    Retrieves the access control object (current authorizations) if one has already been initialized
    Otherwise, initializes it with the default user and returns it
    """
    # Make sure that nothing that relies on knowing what access we have can be cached

    ca = getattr(flask.g, "__depmap_access_control", None)
    if ca:
        """
        __depmap_access_control is set under the following circumstances. see initialize_current_auth.py
            - in before_request when HAS_ACCESS_CONTROL is True, after verifying the user. This is how the deployed webapp normally operates on servers with oauth, i.e. when a request is present
            - after calling all_records_visible. used in the db load, cli commands, and flask shell
            - after calling assume_user. used in celery tasks, and tests for access control
            - after calling this function at least once, since _setup_current_authorizations puts on flask.g
            - tests for access control that do things to set it up
        """
        return ca
    else:
        """
        it is not set under the following circumstances
            - public, local dev, and other places where HAS_ACCESS_CONTROL is False
            - tests
        """
        ca = _initialize_default_user()
        return ca


def _initialize_default_user():
    # set up with default
    user_id = current_app.config["DEFAULT_USER_ID"]
    user_id_override = _get_session_override_if_present(user_id)
    is_admin = current_app.__depmap_auth_config.is_admin(
        user_id
    )  # for local dev, the default user is admin
    ca = _setup_current_authorizations(user_id, is_admin, user_id_override)
    return ca


def _get_session_override_if_present(user_id) -> Optional[str]:
    """
    Should only be directly accessed within utils
    If authenticated user is admin, checks if there is a user override set on the session
    """
    if current_app.__depmap_auth_config.is_admin(user_id):
        # if they are an admin, and an user_override is set in session, use that
        try:
            session._get_current_object()
        except RuntimeError as e:
            # there is no request context, just return None because there is no override
            return None

        # request context exists, check if there is an override
        user_override = session.get("user_override", None)
        # in getting access control
        if user_override != None and user_override != "":
            return user_override

    return None


# related to auth config


def _get_owner_id_from_group_display_name(group_display_name: str):
    for owner_id, group in current_app.__depmap_auth_config.groups.items():
        if group.display_name == group_display_name:
            return owner_id

    raise ValueError(
        "No authorization group with display_name {} found".format(group_display_name)
    )


def _create_authorization_config(groups: List[GroupAuthConfig],) -> AuthorizationConfig:
    assert isinstance(groups, list)
    admin_users = []

    groups_dict: Dict[int, GroupAuthConfig] = {
        PUBLIC_ACCESS_GROUP: PUBLIC_ACCESS_GROUP_AUTH_CONFIG
    }

    for config in groups:
        if config.is_admin_group:
            admin_users = config.users
        else:
            groups_dict[config.owner_id] = config
    return AuthorizationConfig(admin_users, groups_dict)


def _read_groups_from_external_file(file_path):
    with open(file_path) as f:
        code = compile(f.read(), file_path, "exec")
        namespace = {"GroupAuthConfig": GroupAuthConfig}
        exec(code, namespace, namespace)

        assert "AUTH_CONFIG_OBJ" in namespace

    return namespace["AUTH_CONFIG_OBJ"]
