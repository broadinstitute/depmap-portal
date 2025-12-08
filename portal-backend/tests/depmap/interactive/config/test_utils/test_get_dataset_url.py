import pytest
import json
from datetime import date

from depmap.dataset.models import DependencyDataset
from depmap.download.models import (
    DownloadRelease,
    DownloadFile,
    ReleaseType,
    ReleaseTerms,
    FileType,
    DownloadSettings,
)
from depmap.interactive import interactive_utils
from depmap.settings.settings import TestConfig
from loader import taiga_id_loader
from tests.utilities import interactive_test_utils
from tests.factories import (
    DependencyDatasetFactory,
    NonstandardMatrixFactory,
    CustomDatasetConfigFactory,
    TaigaAliasFactory,
)
from tests.depmap.utilities.test_url_utils import assert_url_contains_parts
from tests.depmap.interactive.fixtures import lineage_dataset_id
from tests.utilities.override_fixture import override

nonstandard_dataset_with_download_id = "test-nonstandard-with-download-id.1"
nonstandard_dataset_no_download_id = "test-nonstandard-no-download.1"
standard_with_download_canonical_taiga_id = "test-standard-canonical-id.1/file"
standard_with_download_virtual_taiga_id = "test-standard-virtual-id.1"
custom_taiga_id = "test-custom.1"

standard_no_download_canonical_taiga_id = "test-standard-no-download-canonical.1/file"
standard_no_download_virtual_taiga_id = "test-standard-no-download-virtual.1"

from depmap.settings import download_settings


def config(request):
    """
    Override the default conftest config fixture
    """
    download_list = [
        DownloadRelease(
            name="test release name",
            type=ReleaseType.rnai,
            release_date=date(2011, 1, 1),
            description="test description",
            citation="test citation",
            funding="test funding",
            terms=ReleaseTerms.achilles,
            all_files=[
                DownloadFile(
                    name="test standard dataset",
                    type=FileType.genetic_dependency,
                    size="test size",
                    url="test url",  # urls are tested in the crawler, so this is fine
                    taiga_id=standard_with_download_canonical_taiga_id,
                    description="test file description",
                ),
                DownloadFile(
                    name="test nonstandard dataset",
                    type=FileType.genetic_dependency,
                    size="test size",
                    url="test url",  # urls are tested in the crawler, so this is fine
                    taiga_id=nonstandard_dataset_with_download_id,
                    description="test file description",
                ),
            ],
        )
    ]

    class TestVersionConfig(TestConfig):
        DOWNLOAD_LIST_FOR_TESTS = download_list

        def get_nonstandard_datasets():
            return {
                nonstandard_dataset_with_download_id: {
                    "transpose": False,
                    "use_arxspan_id": True,
                    "label": "test label",
                    "units": "test units",
                    "data_type": "user_upload",
                    "feature_name": "test name",
                    "is_continuous": True,
                },
                nonstandard_dataset_no_download_id: {
                    "transpose": False,
                    "use_arxspan_id": True,
                    "label": "test label",
                    "units": "test units",
                    "data_type": "user_upload",
                    "feature_name": "test name",
                    "is_continuous": True,
                },
            }

        GET_NONSTANDARD_DATASETS = get_nonstandard_datasets

        def get_download_settings():
            return DownloadSettings(
                latest_release_name="test release name",
                latest_release_date="test date",
            )

        GET_DOWNLOAD_SETTINGS = get_download_settings

    return TestVersionConfig


@pytest.fixture(scope="function")
def _empty_db_taiga_aliases_loaded(_empty_db_base):
    TaigaAliasFactory(
        taiga_id=standard_with_download_virtual_taiga_id,
        canonical_taiga_id=standard_with_download_canonical_taiga_id,
    )
    TaigaAliasFactory(
        taiga_id=standard_no_download_virtual_taiga_id,
        canonical_taiga_id=standard_no_download_canonical_taiga_id,
    )

    # the commit is also needed. otherwise, downstream fixtures like populated_db, clear this when they initiation their transation
    taiga_id_loader.load_in_memory_taiga_ids()
    _empty_db_base.session.commit()

    yield _empty_db_base
