import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from breadbox.db.session import SessionWithUser
from tests import factories
from tests.utils import assert_status_ok


class TestSearchReleaseFiles:
    def test_search_basic_keyword(
        self, client: TestClient, minimal_db: SessionWithUser
    ):
        """Verify that a simple keyword search returns the correct file and release info."""
        # 1. Setup: Create two releases with distinct names and files
        factories.release_version(
            minimal_db,
            version_name="Release A",
            files=[{"file_name": "sequencing_data.csv", "datatype": "genomics"}],
        )
        factories.release_version(
            minimal_db,
            version_name="Release B",
            files=[{"file_name": "proteomics_results.csv", "datatype": "proteomics"}],
        )

        minimal_db.flush()

        # 2. Search for "sequencing"
        response = client.get("/release-files/search?q=sequencing")
        assert_status_ok(response)
        results = response.json()

        assert len(results) == 1
        assert results[0]["file_name"] == "sequencing_data.csv"
        # File result should know its parent release name
        assert results[0]["release_version_name"] == "Release A"

    def test_search_pagination_logic(
        self, client: TestClient, minimal_db: SessionWithUser
    ):
        """Verify that limit and offset correctly slice the result set."""
        # Setup: Create 5 files that all match the word "common"
        files = [
            {"file_name": f"common_file_{i}.csv", "datatype": "test"} for i in range(5)
        ]
        factories.release_version(minimal_db, version_name="Paginated", files=files)
        minimal_db.flush()

        # Case 1: Limit to 2 results
        resp_limit = client.get("/release-files/search?q=common&limit=2")
        assert len(resp_limit.json()) == 2

        # Case 2: Offset to get the last result
        # skip first 4, get 1
        resp_offset = client.get("/release-files/search?q=common&limit=10&offset=4")
        assert len(resp_offset.json()) == 1
        assert "common_file_4" in resp_offset.json()[0]["file_name"]

    def test_search_validation_constraints(self, client: TestClient):
        """Verify Query constraints (min_length, ge, le)."""

        # Case 1: Empty query (min_length=1)
        resp_empty = client.get("/release-files/search?q=")
        assert resp_empty.status_code == 422

        # Case 2: Limit too high (le=100)
        resp_too_high = client.get("/release-files/search?q=test&limit=101")
        assert resp_too_high.status_code == 422

        # Case 3: Negative offset (ge=0)
        resp_negative = client.get("/release-files/search?q=test&offset=-1")
        assert resp_negative.status_code == 422

    def test_search_no_results(self, client: TestClient, minimal_db: SessionWithUser):
        """Verify that a search with no matches returns an empty list, not an error."""
        response = client.get("/release-files/search?q=nonexistent_term")
        assert_status_ok(response)
        assert response.json() == []

    def test_search_description_field(
        self, client: TestClient, minimal_db: SessionWithUser
    ):
        # Setup: Keyword 'secret' is ONLY in the description
        factories.release_version(
            minimal_db,
            files=[
                {
                    "file_name": "data.csv",
                    "datatype": "test",
                    "description": "This contains the secret results",
                }
            ],
        )
        minimal_db.flush()
        minimal_db.expire_all()

        # Search for 'secret'
        response = client.get("/release-files/search?q=secret")
        results = response.json()

        assert len(results) == 1
        assert results[0]["file_name"] == "data.csv"

    def test_search_global_across_all_metadata(
        self, client: TestClient, minimal_db: SessionWithUser
    ):
        """
        Verify that a single keyword query 'lung' finds matches in 
        filenames, datatypes, and descriptions.
        """
        # 1. Match in File Name
        factories.release_version(
            minimal_db,
            version_name="Rel_1",
            files=[{"file_name": "lung_cancer_genomics.csv", "datatype": "misc"}],
        )

        # 2. Match in Datatype
        factories.release_version(
            minimal_db,
            version_name="Rel_2",
            files=[{"file_name": "expression.csv", "datatype": "lung_biology"}],
        )

        # 3. Match in Description
        factories.release_version(
            minimal_db,
            version_name="Rel_3",
            files=[
                {
                    "file_name": "metadata.json",
                    "datatype": "clinical",
                    "description": "Patient samples collected from lung tissue",
                }
            ],
        )

        # 4. Match in Release Version Name
        factories.release_version(
            minimal_db,
            version_name="Lung_Atlas_v2",
            files=[{"file_name": "atlas.csv", "datatype": "rna"}],
        )

        # Search for the global keyword
        response = client.get("/release-files/search?q=lung")
        results = response.json()

        # We expect 4 unique files back
        assert len(results) == 4

        # Verify match locations
        found_files = {r["file_name"] for r in results}
        assert "lung_cancer_genomics.csv" in found_files
        assert "expression.csv" in found_files
        assert "metadata.json" in found_files
        assert "atlas.csv" in found_files
