from typing import List

from fastapi import APIRouter, Depends, Query

from breadbox.schemas.release_version import ReleaseFileSearchResponse
from ..crud import release_version as release_version_crud
from breadbox.api.dependencies import get_db_with_user
from breadbox.db.session import SessionWithUser

# Separated from release-versions to reduce confusion about the level
# of granularity of the full text search. Search returns release file
# level data.
router = APIRouter(prefix="/release-files", tags=["release-files"])


@router.get(
    "/search",
    response_model=List[ReleaseFileSearchResponse],
    operation_id="search_release_files",
)
def search_release_files(
    q: str = Query(
        ...,
        min_length=1,
        description="Search query as the user types in the global searchbar.",
    ),
    limit: int = Query(
        50, ge=1, le=100, description="Number of results to return per page. Max 100.",
    ),  # ge "greater than or equal to", le "less than or equal to"
    offset: int = Query(
        0,
        ge=0,
        description="Number of results to skip from the beginning (used for pagination).",
    ),
    db: SessionWithUser = Depends(get_db_with_user),
):
    """
    Search for individual files across all releases using the FTS5 index.
    Returns denormalized metadata for each matching file.
    
    If you have 150 results:

    Page 1: limit=50, offset=0 (Gets results 1-50)

    Page 2: limit=50, offset=50 (Gets results 51-100)

    Page 3: limit=50, offset=100 (Gets results 101-150)
    """
    # This uses the SQLite FTS5 'MATCH' operator
    results = release_version_crud.search_release_files(
        db=db, q=q, limit=limit, offset=offset
    )

    return results
