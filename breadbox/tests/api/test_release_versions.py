from datetime import date, timedelta
from fastapi.testclient import TestClient
from breadbox.db.session import SessionWithUser
from ..utils import assert_status_ok
from tests import factories


class TestGet:
    def test_get_release_versions_empty(self, client: TestClient):
        """Test the list endpoint returns empty list when no data exists."""
        response = client.get(
            "/release-versions/", headers={"X-Forwarded-User": "anyone"}
        )
        assert_status_ok(response)
        assert response.json() == []

    def test_get_release_versions_filtering(
        self, client: TestClient, minimal_db: SessionWithUser
    ):
        """Test filtering by release_name and date windows."""
        today = date.today()
        # Create Release A
        factories.release_version(
            minimal_db,
            release_name="Project A",
            version_name="v1",
            version_date=today - timedelta(days=10),
        )
        # Create Release B
        factories.release_version(
            minimal_db, release_name="Project B", version_name="v1", version_date=today
        )

        # Filter by name
        resp = client.get("/release-versions/?release_name=Project A")
        assert len(resp.json()) == 1
        assert resp.json()[0]["release_name"] == "Project A"

        # Filter by date (should only find Project B)
        resp = client.get(f"/release-versions/?start_date={today}")
        assert len(resp.json()) == 1
        assert resp.json()[0]["release_name"] == "Project B"

    def test_get_single_release_version_and_etag(
        self, client: TestClient, minimal_db: SessionWithUser
    ):
        """Test fetching a single release and verifying ETag/304 logic."""
        release = factories.release_version(minimal_db, version_name="ETagTest")
        release_id = str(release.id)
        content_hash = release.content_hash

        # Initial fetch
        response = client.get(f"/release-versions/{release_id}")
        assert_status_ok(response)
        etag = response.headers.get("ETag")
        assert etag == f'"{content_hash}"'
        assert response.json()["version_name"] == "ETagTest"

        # Test 304 Not Modified
        response_304 = client.get(
            f"/release-versions/{release_id}", headers={"If-None-Match": etag}
        )
        assert response_304.status_code == 304
        assert response_304.text == ""

    def test_get_release_not_found(self, client: TestClient):
        response = client.get("/release-versions/non-existent-uuid")
        assert response.status_code == 404

    def test_get_release_version_include_files_toggle(
        self, client: TestClient, minimal_db: SessionWithUser
    ):
        """Verify that the include_files query param actually toggles the file list."""
        release = factories.release_version(
            minimal_db,
            files=[
                {"file_name": "test.csv", "datatype": "crispr", "is_main_file": True}
            ],
        )
        release_version_id = str(release.id)
        minimal_db.flush()
        minimal_db.expunge_all()

        # 1. include_files=False
        resp_no_files = client.get(
            f"/release-versions/{release_version_id}?include_files=False"
        )
        assert len(resp_no_files.json().get("files", [])) == 0

        minimal_db.flush()
        minimal_db.expunge_all()

        # 2. include_files=True (or default if you set it to True)
        resp_with_files = client.get(
            f"/release-versions/{release_version_id}?include_files=True"
        )
        assert len(resp_with_files.json()["files"]) == 1


class TestPost:
    def test_create_release_version_success(
        self, client: TestClient, minimal_db: SessionWithUser
    ):
        """Test successful creation of a release version."""
        payload = {
            "version_name": "26Q1",
            "release_name": "Public",
            "description": "New release",
            "content_hash": "a" * 32,
            "files": [
                {"file_name": "data.csv", "datatype": "crispr", "is_main_file": True}
            ],
            "release_pipelines": [{"pipeline_name": "Standard", "description": "Desc"}],
        }
        response = client.post("/release-versions/", json=payload)
        assert_status_ok(response)
        data = response.json()
        assert data["version_name"] == "26Q1"
        assert len(data["files"]) == 1

    def test_create_release_version_conflict(
        self, client: TestClient, minimal_db: SessionWithUser
    ):
        """Test that duplicate release/version combinations are rejected."""
        # Create initial
        factories.release_version(
            minimal_db, release_name="Project X", version_name="v1"
        )

        # Try to create same combo
        payload = {
            "version_name": "v1",
            "release_name": "Project X",
            "content_hash": "b" * 32,
        }
        response = client.post("/release-versions/", json=payload)
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]


class TestDelete:
    def test_delete_release_version_success(
        self, client: TestClient, minimal_db: SessionWithUser
    ):
        """Test deleting a release version and verifying it is gone."""
        release = factories.release_version(minimal_db)
        release_id = str(release.id)

        # Delete
        response = client.delete(f"/release-versions/{release_id}")
        assert_status_ok(response)
        assert "deleted successfully" in response.json()["message"]

        # Verify 404 on subsequent get
        get_resp = client.get(f"/release-versions/{release_id}")
        assert get_resp.status_code == 404
