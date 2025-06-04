from depmap.access_control.utils.private_util_functions import (
    _create_authorization_config,
    _read_groups_from_external_file,
)


def load_auth_config_for_app(app):
    """
    sets up app to work with access controls (Specifically, load the auth config and
    set an internal attribute named __depmap_auth_config on the app instance
    """
    if app.config.get("AUTH_CONFIG_OBJ"):
        # used for overriding during testing
        config = _create_authorization_config(app.config["AUTH_CONFIG_OBJ"])

    elif app.config.get("AUTH_CONFIG_FILE"):
        # used for environments with specified config groups
        assert (
            app.config["HAS_USER_ACCOUNTS"]
            or app.config["ENV"] in {"dev", "test", "test-dev"}
            or app.config["IS_LOCAL_OVERRIDE"]
        )
        groups = _read_groups_from_external_file(app.config["AUTH_CONFIG_FILE"])
        config = _create_authorization_config(groups)

    else:
        # create with only the public group. No user has special access. used for the public environment
        config = _create_authorization_config([])

    app.__depmap_auth_config = config
