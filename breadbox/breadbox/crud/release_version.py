from datetime import date
import logging
from typing import Optional, List, Union
from uuid import UUID

from sqlalchemy import and_
from sqlalchemy.orm import joinedload

from breadbox.db.session import SessionWithUser
from ..models.release_version import (
    ReleaseVersion,
    ReleaseFile,
    ReleasePipeline,
    ReleaseFileSearchIndex,
)
from ..schemas.release_version import CreateReleaseVersionParams

log = logging.getLogger(__name__)


def get_release_version_by_release_name_and_version(
    db: SessionWithUser, release_name: str, version_name: str,
) -> Optional[ReleaseVersion]:
    """
    Find a specific version of a named release group, 
    optionally eager-loading associated files.
    """
    query = db.query(ReleaseVersion).filter(
        ReleaseVersion.release_name == release_name,
        ReleaseVersion.version_name == version_name,
    )

    return query.one_or_none()


def get_release_version(
    db: SessionWithUser,
    release_version_id: Union[str, UUID],
    include_files: bool = True,
) -> Optional[ReleaseVersion]:
    """Get a release version by its UUID, optionally eager-loading files."""
    query = db.query(ReleaseVersion).filter(
        ReleaseVersion.id == str(release_version_id)
    )

    if include_files:
        query = query.options(joinedload(ReleaseVersion.files))

    return query.one_or_none()


def get_release_versions(
    db: SessionWithUser,
    release_name: Optional[str] = None,
    datatype: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    include_files: bool = False,
) -> List[ReleaseVersion]:
    """
    Get release versions with optional filtering by name, datatype, and date range.
    """
    query = db.query(ReleaseVersion)

    if include_files:
        query = query.options(joinedload(ReleaseVersion.files))

    if release_name:
        query = query.filter(ReleaseVersion.release_name == release_name)

    if datatype:
        # We join with ReleaseFile to filter by the datatype of its children
        query = (
            query.join(ReleaseVersion.files)
            .filter(ReleaseFile.datatype == datatype)
            .distinct()
        )

    if start_date:
        query = query.filter(ReleaseVersion.version_date >= start_date)

    if end_date:
        query = query.filter(ReleaseVersion.version_date <= end_date)

    return query.order_by(ReleaseVersion.version_date.desc()).all()


def get_release_by_name_and_version(
    db: SessionWithUser, release_name: str, version_name: str
) -> Optional[ReleaseVersion]:
    """Check for an existing specific version within a release group."""
    return (
        db.query(ReleaseVersion)
        .filter(
            and_(
                ReleaseVersion.release_name == release_name,
                ReleaseVersion.version_name == version_name,
            )
        )
        .one_or_none()
    )


def create_release_version(
    db: SessionWithUser, params: CreateReleaseVersionParams
) -> ReleaseVersion:
    """
    Creates a ReleaseVersion and all child entities (Files, Pipelines).
    Also populates the FTS5 Search Index.
    """
    # 1. Create the Parent Release Version
    release_version = ReleaseVersion(
        version_name=params.version_name,
        release_name=params.release_name,
        version_date=params.version_date,
        description=params.description,
        content_hash=params.content_hash,
        citation=params.citation,
        funding=params.funding,
        terms=params.terms,
    )
    db.add(release_version)
    db.flush()

    # 2. Create the Associated Pipelines
    for p in params.release_pipelines:
        pipeline = ReleasePipeline(
            release_version_id=release_version.id,
            pipeline_name=p.pipeline_name,
            description=p.description,
        )
        db.add(pipeline)

    # 3. Create the Associated Files
    created_files = []
    for f in params.files:
        release_file = ReleaseFile(
            **f.model_dump(), release_version_id=release_version.id
        )
        db.add(release_file)
        created_files.append(release_file)

        db.flush()

    # 4. Update the FTS5 Search Index
    _update_search_index(db, release_version, created_files)

    return release_version


def delete_release_version(db: SessionWithUser, release: ReleaseVersion):
    """
    Delete a release version. 
    Cascade deletes will handle ReleaseFile and ReleasePipeline.
    Manually sync the FTS5 Index.
    """
    file_ids = [f.id for f in release.files]

    # sync FTS5 Index
    db.query(ReleaseFileSearchIndex).filter(
        ReleaseFileSearchIndex.rowid.in_(file_ids)
    ).delete(synchronize_session=False)

    db.delete(release)
    db.flush()


def _update_search_index(
    db: SessionWithUser, release: ReleaseVersion, files: List[ReleaseFile]
):
    """
    Helper to populate the FTS5 virtual table.
    Denormalizes release-level info into each file-level row.
    """
    search_entries = []
    for file in files:
        search_entries.append(
            ReleaseFileSearchIndex(
                rowid=file.id,
                file_name=file.file_name,
                file_description=file.description or "",
                file_datatype=file.datatype,
                release_version_name=release.version_name,
                release_name=release.release_name,
                release_version_description=release.description or "",
                release_version_content_hash=release.content_hash,
            )
        )

    db.bulk_save_objects(search_entries)
    db.flush()


# TODO: Fine tune the exact behavior of FTS in phase 3.
def search_release_files(db: SessionWithUser, query_string: str) -> List[dict]:
    """
    Perform a full-text search against the FTS5 index.
    Returns results as a list of dictionaries including the file ID.
    """
    search_results = (
        db.query(ReleaseFileSearchIndex)
        .filter(ReleaseFileSearchIndex.rowid.op("MATCH")(query_string))
        .all()
    )

    return search_results
