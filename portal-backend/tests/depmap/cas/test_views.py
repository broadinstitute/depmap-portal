from depmap.cas.views import cas_get, cas_set
import depmap.cas.util
from flask import url_for
from unittest.mock import Mock

# the base64 sha256 of "sample_value"
EXPECTED_HASH = "AFWKqs8oipMDcZ7FaB5vOGNFGXG35kWsaOjJMfXrxws="


def test_cas_operations(app, monkeypatch):
    blob_storage = {}
    upload_count = 0

    class MockBlob:
        def __init__(self, key):
            self.key = key

        def exists(self):
            return self.key in blob_storage

        def download_as_string(self):
            return blob_storage[self.key]

        def upload_from_string(self, value):
            nonlocal upload_count
            assert isinstance(value, bytes)
            blob_storage[self.key] = value
            upload_count += 1

    # replace function which gets a bucket with a mock version that gets/sets values using the
    # blob_storage dict above
    _mock_bucket = Mock()

    def _mock_blob(key):
        assert isinstance(key, str)
        return MockBlob(key)

    _mock_bucket.blob = Mock(side_effect=_mock_blob)
    monkeypatch.setattr(
        depmap.cas.util, "get_cas_bucket", Mock(return_value=_mock_bucket)
    )

    # the actual tests
    with app.test_client() as c:
        # make sure we get a 404 for something new
        r = c.get(url_for("cas.cas_get", key=EXPECTED_HASH))
        assert r.status_code == 404, r.status_code

        r = c.post(url_for("cas.cas_set"), data={"value": "sample_value"})
        assert r.status_code == 200, r.status_code
        assert r.json == {"key": EXPECTED_HASH}
        assert upload_count == 1

        r = c.get(url_for("cas.cas_get", key=EXPECTED_HASH))
        assert r.status_code == 200, r.status_code
        assert r.json == {"value": "sample_value"}

        # uploading same value shouldn't do an upload
        r = c.post(url_for("cas.cas_set"), data={"value": "sample_value"})
        assert r.status_code == 200, r.status_code
        assert r.json == {"key": EXPECTED_HASH}
        assert upload_count == 1

        # uploading a different value should do a new upload
        r = c.post(url_for("cas.cas_set"), data={"value": "sample_value_2"})
        assert r.status_code == 200, r.status_code
        assert r.json["key"] != EXPECTED_HASH
        assert upload_count == 2
