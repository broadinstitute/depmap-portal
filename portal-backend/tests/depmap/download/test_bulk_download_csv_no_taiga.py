from flask import url_for
from depmap.settings.settings import TestConfig
from io import StringIO
from csv import DictReader
from tests.utilities.override_fixture import override


def config(request):
    """
    Override the default conftest config fixture
    """

    class BulkDownloadCsvTestConfig(TestConfig):
        SHOW_TAIGA_IN_BULK_DOWNLOADS = False

    return BulkDownloadCsvTestConfig


@override(config=config)
def test_bulk_files_csv_no_taiga(empty_db_mock_downloads):
    """
    Test
        the don't show taiga case (e.g. dmc)
        that the shape: csv, rows, columns are correct
    """

    # sanity check the end point doesn't error off and yields a csv file with the right number or rows and header
    with empty_db_mock_downloads.app.test_client() as c:
        r = c.get(url_for("api.download_bulk_files_csv"))
        assert r.status_code == 200, r.status_code
        sin = StringIO(r.data.decode("utf8"))
        r = DictReader(sin)
        rows = list(r)
        assert set(rows[0].keys()) == {
            "filename",
            "release",
            "release_date",
            "url",
            "md5_hash",
        }
        assert len(rows) == 2
