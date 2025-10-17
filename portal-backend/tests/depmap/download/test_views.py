import pytest
from io import StringIO
from csv import DictReader
from json import loads as json_loads
from datetime import date
from flask import url_for
from depmap.dataset.models import DependencyDataset
from depmap.download.models import (
    DownloadRelease,
    DownloadFile,
    ReleaseType,
    ReleaseTerms,
    FileType,
    DownloadSettings,
    ExternalBucketUrl,
    RetractedUrl,
)
from depmap.download.views import (
    get_release_data,
    get_download_records,
    get_file_record,
    is_valid_download_file,
    validate_features,
)
from depmap.utilities.exception import DownloadHeadlinersException
from tests.factories import (
    TaigaAliasFactory,
    GeneFactory,
    MatrixFactory,
    CellLineFactory,
    DependencyDatasetFactory,
)
from tests.utilities import interactive_test_utils
from depmap.settings.download_settings import get_download_list
import urllib.parse


def test_latest_redirect(app):
    def query_params(url):
        parsed = urllib.parse.urlparse(url)
        return urllib.parse.parse_qs(parsed.query)

    with app.test_client() as c:
        r = c.get(url_for("download.view_all", release="LATEST_DEPMAP",))
        assert r.status_code == 302, r.status_code
        assert query_params(r.headers["location"]) == {
            "tab": ["allData"],
            "release": ["test name version"],
        }

    # make sure the other args don't get dropped
    with app.test_client() as c:
        r = c.get(
            url_for("download.view_all", release="LATEST_DEPMAP", file="readme.txt",)
        )
        assert r.status_code == 302, r.status_code
        assert "release=test+name+version&file=readme.txt" in r.headers["location"]
        assert query_params(r.headers["location"]) == {
            "release": ["test name version"],
            "file": ["readme.txt"],
            "tab": ["allData"],
        }


def test_get_file_record(app, _empty_db_base):
    """
    Test that
        fprmat is correct
        works for without and without summary stats
        works with date override
        shows url to the original taiga id, not the canonical

    We use _empty_db_base because it has not yet loaded aliases for in-memory (includes downloads) taiga ids
        We load the taiga alias manually to control the test set up

    """
    # additional set up
    canonical_taiga_id = "should-not-show-in-taiga-url.1"
    TaigaAliasFactory(taiga_id="test-taiga-id.1", canonical_taiga_id=canonical_taiga_id)

    # With SummaryStats
    release = get_download_list()[0]
    f = release.all_files[0]

    # assert test setup
    assert f.taiga_id == canonical_taiga_id

    expected = {
        "sources": ["Broad Institute", "Marcotte et al."],
        "fileName": "test file name",
        "fileType": "Genetic Dependency",
        "version": None,
        "fileSubType": {
            "code": "crispr_screen",
            "label": "CRISPR Screen",
            "position": 0,
        },
        "size": "test size",
        "fileDescription": "<p>test file description</p>",
        "isMainFile": False,
        "retractionOverride": None,
        "downloadUrl": "test url",
        "taigaUrl": "https://cds.team/taiga/dataset/test-taiga-id/1",  # this should be test-taiga-id
        "releaseName": "test name version",
        "terms": "achilles",
        "date": "05/18",
        "summaryStats": [
            {"value": 1, "label": "genes"},
            {"value": 1, "label": "cell lines"},
            {"value": 1, "label": "primary diseases"},
            {"value": 1, "label": "lineages"},
        ],
    }
    assert get_file_record(release, f) == expected

    # No SummaryStats; date override
    f = release.all_files[1]
    expected = {
        "sources": ["Broad Institute"],
        "fileName": "headliner2 file name",
        "fileType": "Cellular Models",
        "version": None,
        "fileSubType": {"code": "mutations", "label": "Mutations", "position": 1},
        "size": "headliner2 size",
        "fileDescription": None,
        "isMainFile": False,
        "retractionOverride": None,
        "downloadUrl": "/download/api/download?file_name=fake%2Ftest%2Fheadliner2_file_name&bucket=depmap-external-downloads",
        "taigaUrl": "https://cds.team/taiga/dataset/test-taiga-id/1",
        "releaseName": "test name version",
        "terms": "achilles",
        "date": "01/00",
    }
    assert get_file_record(release, f) == expected


def test_get_all_downloads(empty_db_mock_downloads):
    """
    Simple test for expected 1st level keys in api
    """
    with empty_db_mock_downloads.app.test_client() as c:
        r = c.get(url_for("download.get_all_downloads"))
        assert r.status_code == 200, r.status_code
        response = json_loads(r.data.decode("utf8"))

    expected_keys = {
        "releaseData",
        "table",
        "source",
        "fileType",
        "releaseType",
        "dataUsageUrl",
    }
    assert set(response.keys()) == expected_keys


def test_get_release_data(app):
    downloads = get_download_list()
    expected = [
        {
            "releaseName": "test name version",
            "releaseGroup": "test name version",
            "releaseVersionGroup": None,
            "releaseType": "RNAi Screens",
            "description": "test description",
            "citation": "test citation",
            "funding": "test funding",
            "isLatest": True,
        }
    ]
    details = get_release_data(downloads)
    assert details == expected


def test_get_download_records(app):
    release: DownloadRelease = get_download_list()[0]
    file: DownloadFile = release.all_files[0]

    downloads = get_download_list()
    expected = [
        get_file_record(release, release.all_files[0]),
        get_file_record(release, release.all_files[1]),
        get_file_record(release, release.all_files[2]),
    ]
    records = get_download_records(downloads)
    assert records == expected


def test_download_dmc_file(app):
    """
    We just verify that it is redirect, because it ultimately redirects to an external url which we cannot follow
    """
    with app.test_client() as c:
        r = c.get(
            url_for(
                "download.download_dmc_file",
                file_name="dmc-resources/2019-symposium/DMC_Symposium_2019_Slides.pdf",
            )
        )
        assert r.status_code == 302, r.status_code


def test_is_valid_external_file():
    url_file_name = "test/url/file/name"
    external_file = DownloadFile(
        "Test Name",
        FileType.genetic_dependency,
        "",
        url=ExternalBucketUrl(url_file_name),
    )
    release = DownloadRelease(
        name="Latest release",
        type=ReleaseType.other_crispr,
        release_date=date(2000, 2, 2),
        description="",
        funding="",
        terms=ReleaseTerms.achilles,
        all_files=[external_file],
    )
    downloads = [release]

    assert is_valid_download_file(downloads, ExternalBucketUrl.BUCKET, url_file_name)
    assert not is_valid_download_file(
        downloads, ExternalBucketUrl.BUCKET, "some/invalid/file/name"
    )


# This was added in response to a bug on the File Downloads page.
# If the release term isn't added to the terms dictionary, the embargo text will
# not show up when the user clicks the download button. Instead, the user
# will just see a blank modal.
def test_download_embargo_text_present(app):
    with app.app_context():
        terms_in_text_dict = ReleaseTerms.get_terms_to_text()

        terms_in_enum = ReleaseTerms.get_all_terms()

        for term in terms_in_enum:
            assert term in terms_in_text_dict


def test_validate_features(app, empty_db_mock_downloads):
    cell_lines = [CellLineFactory()]
    gene_labels_correctly_cased = [
        "gene_SOME_UPPER_CASE",
        "gene_all_lower_1",
        "gene_all_lower_2",
    ]
    genes = [GeneFactory(label=label) for label in gene_labels_correctly_cased]
    dataset_1 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Avana,
        matrix=MatrixFactory(entities=genes, cell_lines=cell_lines),
    )
    dataset_2 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Chronos_Achilles,
        matrix=MatrixFactory(
            entities=[genes[i] for i in [0, 2]], cell_lines=cell_lines
        ),
    )
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    input_valid_genes = ["gene_some_upper_case", "GENE_ALL_LOWER_1", "gene_all_lower_2"]
    input_invalid_genes = ["not a gene", "also not a gene"]

    result = validate_features(input_valid_genes + input_invalid_genes)
    valid = result["valid"]
    invalid = result["invalid"]
    assert set(valid) == set(gene_labels_correctly_cased)
    assert set(invalid) == set(input_invalid_genes)
