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


@override(config=config)
def test_get_dataset_url(app, empty_db_mock_downloads):
    """
    The combinations of things to test are
        standard with a download entry (download link)
        standard without no download entry (taiga for internal) -> NOT TESTED error for public
        nonstandard with download entry (download link)
        nonstandard without download entry (taiga)
        nonstandard without download entry and public -> NOT TESTED
        context and lineage datasets (none)
        custom taiga (taiga)
        custom csv (none)
        uses canonical taiga id to match to download (standard with download)
        uses original (virtual) taiga id to link to taiga (standard without download)

    This does not test the public case where ALLOW_CUSTOM_DOWNLOAD_WITH_TAIGA_URL is false, because Josephine is lazy
    """
    # both standards use the virtual id
    standard_dataset_with_download = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Avana,
        taiga_id=standard_with_download_virtual_taiga_id,  # uses the virtual id
    )
    standard_dataset_no_download = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.RNAi_merged,
        taiga_id=standard_no_download_virtual_taiga_id,  # uses the virtual id
    )
    NonstandardMatrixFactory(
        nonstandard_dataset_with_download_id
    )  # nonstandard_matrix_with_download
    NonstandardMatrixFactory(
        nonstandard_dataset_no_download_id
    )  # nonstandard_matrix_no_download

    custom_dataset_config_with_taiga_id = CustomDatasetConfigFactory(
        config=json.dumps(
            {
                "label": "test label",
                "units": "test axis label",
                "data_type": "user_upload",
                "feature_name": "test feature",
                "is_standard": False,
                "transpose": False,
                "taiga_id": custom_taiga_id,
            }
        )
    )
    custom_dataset_config_csv = CustomDatasetConfigFactory()

    empty_db_mock_downloads.session.flush()

    # load the interactive
    interactive_test_utils.reload_interactive_config()

    # standard with a download entry (download link)
    # this also tests that the download is correctly found, despite the download using the canonical
    assert_url_contains_parts(
        interactive_utils.get_dataset_url(standard_dataset_with_download.name.name),
        ["/download/all/", "release=test+release+name", "file=test+standard+dataset"],
    )

    # standard without no download entry (taiga for internal) -> NOT TESTED error for public
    # this also tests that the virtual taiga id is used to make the link
    assert (
        interactive_utils.get_dataset_url(standard_dataset_no_download.name.name)
        == "https://cds.team/taiga/dataset/test-standard-no-download-virtual/1"
    )

    # nonstandad with download entry (download link)
    assert interactive_utils.get_dataset_url(nonstandard_dataset_with_download_id)

    # nonstandard without download entry (taiga)
    assert (
        interactive_utils.get_dataset_url(nonstandard_dataset_no_download_id)
        == "https://cds.team/taiga/dataset/test-nonstandard-no-download/1"
    )

    # context and lineage datasets (none)
    assert interactive_utils.get_dataset_url(lineage_dataset_id) == None

    # custom taiga (taiga)
    assert (
        interactive_utils.get_dataset_url(custom_dataset_config_with_taiga_id.uuid)
        == "https://cds.team/taiga/dataset/test-custom/1"
    )

    # custom csv (none)
    assert interactive_utils.get_dataset_url(custom_dataset_config_csv.uuid) is None
