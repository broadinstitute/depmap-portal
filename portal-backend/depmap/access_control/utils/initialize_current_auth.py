from flask import current_app
import flask
import contextlib
from . import private_util_functions


def initialize_request_user(user_id):
    """
    This should be the primary way that current authorizations is initialized
    I.e., when there is a normal request on a server with oauth, and this function is passed in the authenticated user_id
    """
    user_id_override = private_util_functions._get_session_override_if_present(user_id)

    is_admin = current_app.__depmap_auth_config.is_admin(user_id)

    # this puts private_util_functions.__depmap_access_control on flask.g
    private_util_functions._setup_current_authorizations(
        user_id, is_admin, user_id_override=user_id_override
    )


@contextlib.contextmanager
def all_records_visible(*, allow_unsafe_promotion=False):
    """
    A context manager intended to be called with 'with' to force everything visible. intended just for the db loader and tests.

    :param allow_unsafe_promotion: If set, allows for all_records_visible to be called even if there already is
    an active set of access control restrictions in place. This should only be used in tests. In application code
    we should only narrow access granted to the current request, never broaden access.

    Example:
        The following will let the function "fn()" see everything in the database and then restore the
        original access controls once the with block exits.

        with all_records_visible():
            fn()

    """
    # store the original ca, to restore it later
    original_ca = getattr(flask.g, "__depmap_access_control", None)
    assert (
        original_ca is None
        or original_ca.is_everything_visible
        or allow_unsafe_promotion
    ), "Attempted to promote access to all_records_visible, but already in a context with reduced permissions"
    # The difference with this line and the above is that the line the line below will create a default user if none is present
    ca = private_util_functions._get_access_control_obj()

    authorization_config = current_app.__depmap_auth_config
    private_util_functions._setup_current_authorizations(
        ca.authenticated_user_id,
        ca.is_admin,
        "all_records_visible context manager",
        authorization_config.groups,
    )

    # setup_current_authorizations should have put ca on flask.g
    # we are retrieving and re-assigning it in order to set is_everything_visible
    ca = flask.g.__depmap_access_control

    ca.is_everything_visible = True
    flask.g.__depmap_access_control = ca

    try:
        yield
    finally:
        flask.g.__depmap_access_control = original_ca


@contextlib.contextmanager
def assume_user(user_id, make_admin=None):
    """
    A context manager intended to be called with 'with' to temporarily assume the access of the specified user.
    This intended for the db load and celery tasks
    """
    # store the original ca, to restore it later
    original_ca = getattr(flask.g, "__depmap_access_control", None)

    # The difference with this line and the above is that the line the line below will create a ca object for the
    # default user if none is present
    ca = private_util_functions._get_access_control_obj()
    if make_admin is True or make_admin is False:
        is_admin = make_admin
    else:
        assert make_admin is None
        # if the caller didn't specifically say how to set the admin flag, set it based on the user
        is_admin = current_app.__depmap_auth_config.is_admin(user_id)

    private_util_functions._setup_current_authorizations(
        ca.authenticated_user_id, is_admin, user_id
    )

    try:
        yield
    finally:
        flask.g.__depmap_access_control = original_ca
