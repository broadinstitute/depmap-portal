from json import loads as json_loads
from flask import url_for
import urllib.parse


def test_get_all_data(empty_db_mock_downloads):
    """
    Simple test for expected 1st level keys in api
    """
    with empty_db_mock_downloads.app.test_client() as c:
        r = c.get(url_for("data_page.get_all_data"))
        assert r.status_code == 200, r.status_code
        response = json_loads(r.data.decode("utf8"))

    expected_keys = {
        "table",
        "releaseData",
        "currentRelease",
        "fileType",
        "releaseType",
        "source",
        "dataUsageUrl",
    }
    assert set(response.keys()) == expected_keys


def test_redirect_from_old_page(populated_db):
    with populated_db.app.test_client() as c:
        r = c.get(url_for("download.view_all"), content_type="application/json",)
        assert r.status_code == 302, r.status_code


def test_latest_redirect(app):
    def query_params(url):
        parsed = urllib.parse.urlparse(url)
        return urllib.parse.parse_qs(parsed.query)

    with app.test_client() as c:
        r = c.get(url_for("data_page.view_data_page", release="LATEST_DEPMAP",))
        assert r.status_code == 302, r.status_code
        assert query_params(r.headers["location"]) == {
            "release": ["test name version"],
            "tab": ["allData"],
        }

    # make sure the other args don't get dropped
    with app.test_client() as c:
        r = c.get(
            url_for(
                "data_page.view_data_page", release="LATEST_DEPMAP", file="readme.txt",
            )
        )
        assert r.status_code == 302, r.status_code
        assert "release=test+name+version&file=readme.txt" in r.headers["location"]
        assert query_params(r.headers["location"]) == {
            "release": ["test name version"],
            "file": ["readme.txt"],
            "tab": ["allData"],
        }
