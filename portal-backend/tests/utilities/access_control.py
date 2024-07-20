import contextlib
from flask import session
from depmap.access_control import (
    initialize_request_user,
    get_owner_id_from_group_display_name,
)


@contextlib.contextmanager
def request_as_user(app, email, session_email=None):
    """
    This is a utilitiy function for testing, to simulate running code in a request with the specified user
    This is useful for testing access control, or data and functionality relating to access control (see the access control module)
        It doesn't test the full route with oauth signing headers, or before_request
        Instead, we manually call the method used in before_request

    Explanation for why app.app_context is needed
        conftest pushes an application context, which also has a request context
        in tests, if writing app.test_request_context, a request context is pushed
            BUT, a new application context is not created
            this means that flask.g is not cleared.
            and access control is cached on flask.g
        under normal situations, an incoming request creates both the request and application contexts
        but in testing, where we may nest different request contexts and actually also want different application contexts, we need to explicitly call app.app_context()

    Explanation for calling initialize_request_user
        a normal request will go through before_request, which authenticates signed oauth headers and initializes the user accordingly
        this requires that the headers must be signed for X-Forwarded-Email to be used
        to get around that for testing, we directly call initialize_request_user which is used in before_request, ignoring the authentication step
    """
    with app.app_context():
        with app.test_request_context("/", headers={"X-Forwarded-Email": email}):
            session["user_override"] = session_email

            initialize_request_user(email)

            yield


def get_canary_group_id():
    """
    A handful of tests want the CANARY_GROUP_ID variable for set up purposes
    It cannot be directly imported from the config file in the sample_data directory used for tests, because the file contains references to GroupAuthConfig which is not in its namespace
    In normal app execution, the file is imported with a function in initialize_auth_config.py, which provides GroupAuthConfig to the name space of the config file, and evaluates the config file
    So, this is just a test utility, that makes use of the normal app's reading of the config file, and wraps in an easy function to just get the canary value that tests want
    """
    return get_owner_id_from_group_display_name("Canary")
