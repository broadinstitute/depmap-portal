from depmap.settings.settings import TestConfig
from depmap.access_control import assume_user
from depmap.download.models import (
    DownloadRelease,
    ReleaseType,
    ReleaseTerms,
)
from datetime import date
from tests.utilities.override_fixture import override
from depmap.settings.download_settings import get_download_list


def config(request):
    """
    Override the default conftest config fixture
    """

    class TestVersionConfig(TestConfig):
        DOWNLOAD_LIST_FOR_TESTS = test_downloads = [
            DownloadRelease(
                name="public",
                type=ReleaseType.rnai,
                release_date=date(2018, 5, 8),
                description="test description",
                citation="test citation",
                funding="test funding",
                terms=ReleaseTerms.achilles,
                all_files=[],
            ),
            DownloadRelease(
                name="private",
                owner_group_display_name="Canary",
                type=ReleaseType.rnai,
                release_date=date(2018, 5, 8),
                description="test description",
                citation="test citation",
                funding="test funding",
                terms=ReleaseTerms.achilles,
                all_files=[],
            ),
        ]

    return TestVersionConfig


@override(config=config)
def test_downloads_access_control(empty_db_mock_downloads):
    downloads = get_download_list()
    assert {"public"} == set([x.name for x in downloads])
    with assume_user("canary@canary.com"):
        downloads = get_download_list()
    assert {"public", "private"} == set([x.name for x in downloads])
