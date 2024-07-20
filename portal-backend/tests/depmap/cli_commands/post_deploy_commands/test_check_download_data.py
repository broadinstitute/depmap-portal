import pytest
from datetime import date
from depmap.enums import BiomarkerEnum, DependencyEnum
from flask import current_app
from depmap.cli_commands.post_deploy_commands.check_download_data import (
    _check_download_data,
    DownloadIssueType,
)
from depmap.download.models import (
    DownloadRelease,
    DownloadFile,
    SummaryStats,
    ReleaseType,
    ReleaseTerms,
    FileType,
    BucketUrl,
    ExternalBucketUrl,
)
from tests.factories import DependencyDatasetFactory, BiomarkerDatasetFactory


def test_check_download_data_no_db(app):
    _test_check_download_data(None)


def test_check_download_data_with_db(empty_db_mock_downloads):
    _test_check_download_data(empty_db_mock_downloads)


# if db is None, then tests without using DB


def _test_check_download_data(db):
    """
    Test that
        Duplicate taiga ids are detected
        Duplicate urls are detected
        For both DependencyDataset and BiomarkerDataset
            Missing DownloadFile is detected
        All headliners have primary files
    Unfortunately we don't distinguish between the errors
    """
    pass

    # # test missing download dataset extension
    # files = [
    #     download_file_factory(1, dep_taiga_id),
    #     download_file_factory(2, biom_taiga_id)
    # ]
    # download = download_release_factory(files)
    # with pytest.raises(AssertionError) as e:
    #     _check_download_data([download], headliner_settings)
    #     assert IssueType.headliner_without_summary_stats.value in str(e.value)

    # test normal situation, runs through fine

    # test duplicate release names

    # test bad taiga id

    # test duplicate file names

    # test duplicate string urls

    # test duplicate Bucket urls

    # test missing downloadfile

    # test no headliner_name_override or taiga id

    # test taiga ID of file does not match any Dataset, and no
    # headliner_name_override

    # separate setup since every dataset needs a download entry

    # test taiga ID of file matches two Dataset objects, and no
    # headliner_name_override
    # test taiga ID of file matches two Dataset objects, and no
    # headliner_name_override


def download_release_factory(files):
    download = DownloadRelease(
        name="Test Check Download Data",
        type=ReleaseType.other_crispr,
        release_date=date(2018, 5, 8),
        description="test description",
        citation="test citation",
        funding="test funding",
        terms=ReleaseTerms.achilles,
        all_files=files,
    )

    return download


def download_file_factory(url_unique, taiga_id, file_name=None, file_type=None):
    """
    :param url_unique: If string, will generate a string url with provided identifier. If other type, will use url_unique as the url
    :param taiga_id: also used as unique idenfitier for file name unless provided
    """
    return DownloadFile(
        name="test name {}".format(taiga_id) if file_name is None else file_name,
        type=FileType.genetic_dependency if file_type is None else file_name,
        size="test size",
        url="test url {}".format(url_unique)
        if not isinstance(url_unique, BucketUrl) is None
        else url_unique,
        taiga_id=taiga_id,
    )
