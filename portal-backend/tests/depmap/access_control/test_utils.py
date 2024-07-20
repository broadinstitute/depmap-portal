from typing import List
from depmap.access_control import get_owner_id_from_group_display_name
from depmap.access_control.models import GroupAuthConfig
from depmap.settings.settings import TestConfig
from tests.utilities.override_fixture import override

# write out config with a single user
AUTH_CONFIG_OBJ: List[GroupAuthConfig] = [
    GroupAuthConfig(
        "Display Name 1", "description 1", users=["test@sample.com"], owner_id=1
    ),
    GroupAuthConfig(
        "Display Name 2", "description 2", users=["test@sample.com"], owner_id=2
    ),
]


def config(request):
    """
    Override the default conftest config fixture
    """

    class TestAccessControlConfig(TestConfig):
        AUTH_CONFIG_OBJ = AUTH_CONFIG_OBJ

    return TestAccessControlConfig


@override(config=config)
def test_get_owner_id_from_group_display_name(app):
    assert get_owner_id_from_group_display_name("Display Name 1") == 1
    assert get_owner_id_from_group_display_name("Display Name 2") == 2
