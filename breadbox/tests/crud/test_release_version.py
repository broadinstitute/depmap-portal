from datetime import date, timedelta
from typing import Optional
from uuid import uuid4
from breadbox.models.release_version import ReleaseFileSearchIndex
from breadbox.db.session import SessionWithUser
from breadbox.crud.release_version import (
    get_release_version,
    get_release_versions,
    delete_release_version,
)
from breadbox.models.release_version import ReleaseVersion, ReleaseFile
from tests import factories
from sqlalchemy import inspect


def test_get_release_version(minimal_db: SessionWithUser):
    """Test that a release version can be retrieved by its ID."""
    release = factories.release_version(
        minimal_db, release_name="DepMap Public", version_name="26Q1"
    )

    # Test retrieval by ID
    retrieved = get_release_version(minimal_db, release.id)
    assert retrieved is not None
    assert retrieved.version_name == "26Q1"

    # Test non-existent ID
    random_id = uuid4()
    assert get_release_version(minimal_db, random_id) is None


def test_get_release_versions_date_ranges(minimal_db: SessionWithUser):
    """
    Test filtering by specific publication windows: 
    Last month, 6 months, 12 months, 2 years, and All.
    """
    today = date.today()

    # 1. Create a release for each specific time bucket. For testing purposes, treat a month
    # as 30 days long.
    release_2_weeks_ago = factories.release_version(
        minimal_db, version_name="2w_ago", version_date=today - timedelta(days=14)
    )
    release_4_months_ago = factories.release_version(
        minimal_db, version_name="4m_ago", version_date=today - timedelta(days=120)
    )
    release_9_months_ago = factories.release_version(
        minimal_db, version_name="9m_ago", version_date=today - timedelta(days=270)
    )
    release_18_months_ago = factories.release_version(
        minimal_db, version_name="18m_ago", version_date=today - timedelta(days=540)
    )
    release_3_years_ago = factories.release_version(
        minimal_db, version_name="3y_ago", version_date=today - timedelta(days=1095)
    )

    # Helper to count results based on start_date
    def count_releases(days_back: Optional[int]):
        start_date = today - timedelta(days=days_back) if days_back else None
        return get_release_versions(minimal_db, start_date=start_date)

    # 2. Assertions

    # LAST MONTH (30 Days)
    # Should only find: 2w_ago
    last_month = count_releases(30)
    assert len(last_month) == 1
    assert last_month[0].version_name == "2w_ago"

    # LAST 6 MONTHS (180 Days)
    # Should find: 2w_ago, 4m_ago
    last_6_months = count_releases(180)
    assert len(last_6_months) == 2

    # LAST 12 MONTHS (365 Days)
    # Should find: 2w_ago, 4m_ago, 9m_ago
    last_12_months = count_releases(365)
    assert len(last_12_months) == 3

    # LAST 2 YEARS (730 Days)
    # Should find: 2w_ago, 4m_ago, 9m_ago, 18m_ago
    last_2_years = count_releases(730)
    assert len(last_2_years) == 4

    # ALL (No start_date)
    # Should find all 5 releases
    all_releases = count_releases(None)
    assert len(all_releases) == 5


def test_delete_release_version_cascade_and_search_sync(minimal_db: SessionWithUser):
    """
    Test that deleting a release version cleans up files, pipelines, 
    and the FTS5 Search Index.
    """
    file_metadata = [
        {
            "file_name": "target_file.csv",
            "datatype": "crispr",
            "is_main_file": True,
            "md5_hash": "0" * 32,
        }
    ]

    # 1. Create the version and the file together
    release = factories.release_version(
        minimal_db, version_name="Delete", files=file_metadata
    )

    minimal_db.refresh(release)

    release_id = release.id
    file_id = release.files[0].id

    # 2. Verify Search Index is initially populated
    initial_search = (
        minimal_db.query(ReleaseFileSearchIndex)
        .filter(ReleaseFileSearchIndex.rowid == file_id)
        .one_or_none()
    )
    assert initial_search is not None
    assert initial_search.file_name == "target_file.csv"

    # 3. Deletion
    # This should trigger both the DB cascade and our manual FTS cleanup
    delete_release_version(minimal_db, release)
    minimal_db.flush()

    # 4. Assert Data is gone
    assert minimal_db.query(ReleaseVersion).get(release_id) is None
    assert minimal_db.query(ReleaseFile).get(file_id) is None

    # 5. Assert Search Index is in sync
    # If this fails, it means we have "orphaned" search results pointing to non-existent files
    deleted_search = (
        minimal_db.query(ReleaseFileSearchIndex)
        .filter(ReleaseFileSearchIndex.rowid == file_id)
        .one_or_none()
    )
    assert deleted_search is None


def test_get_release_versions_filtering(minimal_db: SessionWithUser):
    """Test filtering by release_name, datatype, and combined date windows."""
    today = date.today()

    # 1. Create a variety of releases
    # Release A: CRISPR data from last year
    release_a = factories.release_version(
        minimal_db,
        release_name="Project A",
        version_name="v1",
        version_date=today - timedelta(days=400),
    )
    factories.release_file(minimal_db, release_a, datatype="crispr")

    # Release B: RNAseq data from last month
    release_b = factories.release_version(
        minimal_db,
        release_name="Project B",
        version_name="v1",
        version_date=today - timedelta(days=30),
    )
    factories.release_file(minimal_db, release_b, datatype="rnaseq")

    # Release C: CRISPR data from today (Same release name as A)
    release_c = factories.release_version(
        minimal_db, release_name="Project A", version_name="v2", version_date=today
    )
    factories.release_file(minimal_db, release_c, datatype="crispr")

    # Test 1: Filter by release_name
    # Should find both v1 and v2 of Project A
    project_a_results = get_release_versions(minimal_db, release_name="Project A")
    assert len(project_a_results) == 2
    assert all(r.release_name == "Project A" for r in project_a_results)

    # Test 2: Filter by datatype
    # Should find Project A v1 and Project A v2 (CRISPR), but not B (RNAseq)
    crispr_results = get_release_versions(minimal_db, datatype="crispr")
    assert len(crispr_results) == 2
    assert set(r.id for r in crispr_results) == {release_a.id, release_c.id}
    # Ensure distinctness (no duplicates even if release has multiple crispr files)
    factories.release_file(
        minimal_db, release_c, datatype="crispr", file_name="another_crispr.csv"
    )
    crispr_results_deduped = get_release_versions(minimal_db, datatype="crispr")
    assert len(crispr_results_deduped) == 2

    # Test 3: Filter by specific date window
    # Filter for anything published between 1 year ago and 2 weeks ago
    # Should only find Project B (30 days ago)
    start = today - timedelta(days=365)
    end = today - timedelta(days=14)
    window_results = get_release_versions(minimal_db, start_date=start, end_date=end)
    assert len(window_results) == 1
    assert window_results[0].id == release_b.id

    # Test 4: Combined Filter (Datatype + Release Name)
    # Project A CRISPR files
    combined_results = get_release_versions(
        minimal_db, release_name="Project A", datatype="crispr"
    )
    assert len(combined_results) == 2

    # Test 5: All filters combined (Datatype + Release Name + Date Range)
    # We want Project A, CRISPR data, but only from the last 7 days.
    # This should include Release C (today) but exclude Release A (400 days ago)
    # and Release B (wrong name/type).
    triple_filter_results = get_release_versions(
        minimal_db,
        release_name="Project A",
        datatype="crispr",
        start_date=today - timedelta(days=7),
    )
    assert len(triple_filter_results) == 1
    assert triple_filter_results[0].id == release_c.id
    assert triple_filter_results[0].version_name == "v2"


def test_get_release_versions_include_files_toggle(minimal_db: SessionWithUser):
    """
    Test that include_files=True eagerly loads files, 
    and include_files=False (using noload) returns an empty list.
    """
    # 1. Setup
    file_name = "data.csv"
    factories.release_version(
        minimal_db,
        version_name="IncludeTest",
        files=[{"file_name": file_name, "datatype": "crispr", "is_main_file": True}],
    )

    minimal_db.flush()
    minimal_db.expunge_all()

    # Case 1: include_files=False
    results_no_files = get_release_versions(minimal_db, include_files=False)
    assert len(results_no_files) == 1

    # With noload, the attribute is considered "loaded" as an empty list.
    assert len(results_no_files[0].files) == 0
    # Verify 'files' is NOT in the 'unloaded' set because noload handled it.
    assert "files" not in inspect(results_no_files[0]).unloaded

    # Case 2: include_files=True
    minimal_db.expunge_all()  # Reset session again

    results_with_files = get_release_versions(minimal_db, include_files=True)
    assert len(results_with_files) == 1
    assert len(results_with_files[0].files) == 1
    assert results_with_files[0].files[0].file_name == file_name

    # Verify the 'files' relationship is loaded with actual data
    assert "files" not in inspect(results_with_files[0]).unloaded


def test_get_release_version_include_files_toggle(minimal_db: SessionWithUser):
    """
    Test that get_release_version correctly toggles eager loading with include_files
    for a single release UUID.
    """
    # 1. Setup
    file_name = "detail.csv"
    release = factories.release_version(
        minimal_db,
        files=[{"file_name": file_name, "datatype": "crispr", "is_main_file": True}],
    )
    release_id = release.id
    minimal_db.flush()
    minimal_db.expunge_all()

    # 2. Case A: include_files=False
    retrieved_no_files = get_release_version(
        minimal_db, release_id, include_files=False
    )
    assert retrieved_no_files is not None

    # noload ensures the collection is empty and no lazy-load will trigger
    assert len(retrieved_no_files.files) == 0
    assert "files" not in inspect(retrieved_no_files).unloaded

    # 3. Case B: include_files=True
    minimal_db.expunge_all()  # Reset session to force a fresh JOIN query

    retrieved_with_files = get_release_version(
        minimal_db, release_id, include_files=True
    )

    assert retrieved_with_files is not None
    assert len(retrieved_with_files.files) == 1
    assert retrieved_with_files.files[0].file_name == file_name
    assert "files" not in inspect(retrieved_with_files).unloaded
