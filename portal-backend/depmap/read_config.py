# -*- coding: utf-8 -*-
"""Application configuration."""


def read_config(env_name, config_path=None):
    """
    Retrieves a configuration object for the given environment in the given configs.

    env_name: should be a plain environment name like "dev" or"istaging".
        For backwards-compatibility, the env_name may also include the config path separated by a ":"
        (For example, "./config/internal/settings.py:istaging").
    config_path: The path will be evaluated and we'll look for a config with the appropriate name within the 
        resulting objects.  If not specified, the path defaults to ../config/dev/settings.py.
    """
    assert isinstance(env_name, str)
    if ":" in env_name:
        # handle this case for backwards compatibility
        py_path, env_name = env_name.split(":")
    if config_path is not None:
        py_path = config_path
    else:
        py_path = "../config/dev/settings.py"

    with open(py_path, "rt") as fd:
        contents = fd.read()
    code = compile(contents, py_path, "exec")
    scope = {"__name__": f"depmap_parsed_config"}
    exec(code, scope, scope)

    # find all the configs and index them by "ENV" name
    name_to_config = {}
    for name, obj in scope.items():
        if hasattr(obj, "ENV"):
            assert obj.ENV not in name_to_config
            name_to_config[obj.ENV] = obj

    config = name_to_config[env_name]
    return config
