# This file is used for dev and test
# GroupAuthConfig is deliberately not imported
# Instead, see depmap/access_control/utils/initialize_auth_config.py::_read_groups_from_external_file for how this file is read
# Production versions of these files are separate configuration files in different repositories

# DO NOT RENUMBER THESE. Always add a new one and do not delete.
__UNUSED_VARIABLE_ZERO_IS_RESERVED_FOR_THE_PUBLIC_ACCESS_GROUP = 0
CANARY_GROUP_ID = 2  # used by tests and development
# Configure which users are allowed to see which group_ids.


AUTH_CONFIG_OBJ = [
    GroupAuthConfig(
        "Admin",
        "devs allowed to impersonate other users",
        True,
        [
            "dev@sample.com",  # user when running on locally
            # for remote instances, we also have accounts of devs, so that we can switch users on remote instances
        ],
    ),
    GroupAuthConfig(
        "Canary",  # this mashes the hardcode in tests/utilities/access_control.py::get_canary_group_id
        "a group which owns private data which can be used for testing",
        users=["canary@sample.com"],
        email_domains=["canary.com", "canary.org"],
        owner_id=CANARY_GROUP_ID,
    ),
]
