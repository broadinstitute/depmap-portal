from datetime import date
from typing import List, Optional, Annotated
from logging import getLogger
from fastapi import APIRouter, Depends, HTTPException, Response, Body, Query

from breadbox.api.dependencies import get_db_with_user
from breadbox.db.session import SessionWithUser
from breadbox.db.util import transaction
from breadbox.schemas.custom_http_exception import UserError

from ..crud import release_version as release_version_crud
from ..models.release_version import ReleaseVersion
from ..schemas.release_version import (
    ReleaseVersionResponse,
    CreateReleaseVersionParams,
)

router = APIRouter(prefix="/release-versions", tags=["release-versions"])
log = getLogger(__name__)


def _get_required_release_version(
    db: SessionWithUser, release_version_id: str
) -> ReleaseVersion:
    """Helper to fetch a release_version or raise 404"""
    release_version = release_version_crud.get_release_version(db, release_version_id)
    if release_version is None:
        raise HTTPException(
            status_code=404,
            detail=f"Release version with id {release_version_id} not found",
        )
    return release_version


@router.get(
    "/",
    operation_id="get_release_versions",
    response_model=List[ReleaseVersionResponse],
)
def get_release_versions(
    release_name: Optional[str] = Query(None, description="Filter by grouping name"),
    datatype: Optional[str] = Query(
        None, description="Filter by file datatype (e.g. 'crispr')"
    ),
    start_date: Optional[date] = Query(
        None, description="Filter releases published on or after this date (YYYY-MM-DD)"
    ),
    end_date: Optional[date] = Query(
        None,
        description="Filter releases published on or before this date (YYYY-MM-DD)",
    ),
    include_files: bool = Query(
        False,
        description="If true, includes the list of files for each release in the response.",
    ),
    db: SessionWithUser = Depends(get_db_with_user),
):
    """
    Get a list of available release versions, filtered by metadata or date ranges.
    """
    return release_version_crud.get_release_versions(
        db,
        release_name=release_name,
        datatype=datatype,
        start_date=start_date,
        end_date=end_date,
        include_files=include_files,
    )


@router.get(
    "/{release_version_id}",
    operation_id="get_release_version",
    response_model=ReleaseVersionResponse,
)
def get_release_version(
    release_version_id: str,
    response: Response,
    db: SessionWithUser = Depends(get_db_with_user),
    if_none_match: Optional[str] = Depends(lambda r: r.headers.get("If-None-Match")),
):
    """
    Get full metadata for a specific release version.
    Includes ETag support via content_hash.
    """
    release = _get_required_release_version(db, release_version_id)

    # ETag / 304 logic
    etag = f'"{release.content_hash}"'
    if if_none_match == etag:
        return Response(status_code=304)

    response.headers["ETag"] = etag
    return release


@router.post(
    "/", operation_id="create_release_version", response_model=ReleaseVersionResponse,
)
def create_release_version(
    params: Annotated[CreateReleaseVersionParams, Body()],
    db: SessionWithUser = Depends(get_db_with_user),
):
    """
    Register a new release version and its associated files/pipelines.
    This is typically called by the data loader.
    """
    # Check for existing version/release name combo - must be unique
    existing = release_version_crud.get_release_version_by_release_name_and_version(
        db, params.release_name, params.version_name
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Release '{params.release_name}' version '{params.version_name}' already exists.",
        )

    try:
        with transaction(db):
            new_release_version = release_version_crud.create_release_version(
                db, params
            )
            return new_release_version
    except Exception as e:
        log.error(f"Failed to create release version: {e}")
        raise UserError(f"Failed to create release version: {str(e)}")


@router.delete(
    "/{release_version_id}", operation_id="delete_release_version",
)
def delete_release_version(
    release_version_id: str, db: SessionWithUser = Depends(get_db_with_user),
):
    """
    Delete a release version. Associated files and pipelines will be 
    deleted automatically via cascade.
    """
    release = _get_required_release_version(db, release_version_id)

    with transaction(db):
        release_version_crud.delete_release_version(db, release)
        return {
            "message": f"Release version {release_version_id} deleted successfully."
        }
