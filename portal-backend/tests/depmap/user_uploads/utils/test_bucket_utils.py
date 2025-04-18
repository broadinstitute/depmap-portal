from depmap.settings.settings import TestConfig

FAKE_PROJECT = "depmap-tests-fake-project"


def config(request):
    """
    Override the default conftest config fixture
    """

    class TestDStagingConfig(TestConfig):
        ENV = "dstaging"
        HAS_USER_ACCOUNTS = True  # we need to set this to appease a check

    return TestDStagingConfig
