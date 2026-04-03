from fastapi import APIRouter, Depends, HTTPException, Query

from breadbox.api.dependencies import get_db_with_user
from breadbox.db.session import SessionWithUser

# Separated from release-versions to reduce confusion about the level
# of granularity of the full text search. Search returns release file
# level data.
router = APIRouter(prefix="/release-files", tags=["release-files"])


@router.get("/search", operation_id="search_release_files")
def search_release_files(
    q: str = Query(
        ...,
        min_length=1,
        description="Search query as the user types in the global searchbar.",
    ),
    db: SessionWithUser = Depends(get_db_with_user),
):
    """
    Search for individual files across all releases using the FTS5 index.
    (Note: Will implement the CRUD methods in Phase 3).
    """
    # This will be implemented in Phase 3 once search_crud
    raise HTTPException(
        status_code=501, detail="Search functionality is coming in Phase 3"
    )
