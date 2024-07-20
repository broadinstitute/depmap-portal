import pandas as pd

from depmap.settings.settings import TestConfig
from depmap.user_uploads.utils.bucket_utils import (
    _get_private_datasets_file,
    get_user_upload_records,
)
from tests.utilities.override_fixture import override

FAKE_PROJECT = "depmap-tests-fake-project"


def config(request):
    """
    Override the default conftest config fixture
    """

    class TestDStagingConfig(TestConfig):
        ENV = "dstaging"
        HAS_USER_ACCOUNTS = True  # we need to set this to appease a check

    return TestDStagingConfig


def private_datasets_map_df(request):
    df = pd.DataFrame(columns=["fake"], data=[[1], [2]])
    return df


@override(config=config)
def test_get_private_datasets_file_bucket_overrides(
    empty_db_mock_downloads, upload_private_dataset_setup
):
    "Test that dstaging uses dprod GCS folder"
    f = _get_private_datasets_file("fake_file")
    assert f.name == "dprod/fake_file"
