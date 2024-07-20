from typing import List, Optional
from urllib.parse import urlencode
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from breadbox.db.session import SessionWithUser
from .dependencies import get_db_with_user, get_user
from ..crud import metadata as metadata_crud

router = APIRouter(prefix="/metadata", tags=["metadata"])


@router.get(
    "/", response_model=metadata_crud.MetadataResponse, operation_id="get_metadata",
)
def get_metadata(
    label_or_id: str, db: SessionWithUser = Depends(get_db_with_user)
) -> metadata_crud.MetadataResponse:
    """
    Provide either a feature/sample id or label and return all metadata for that feature/sample
    """
    try:
        metadata = metadata_crud.get_metadata_list_for_dimension_label(
            db=db, label_or_id=label_or_id
        )
    except ValueError as e:
        raise HTTPException(400, detail=str(e))

    return metadata


class SearchResponse(BaseModel):
    labels: List[str]


@router.get(
    "/search",
    response_model=SearchResponse,
    operation_id="get_metadata_search_options",
)
def get_metadata_search_options(
    text: str,  # Could be feature_label or sample_id
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
):
    try:
        search_options = metadata_crud.get_metadata_search_options(db, user, text)
    except ValueError as e:
        raise HTTPException(400, detail=str(e))

    return SearchResponse(labels=search_options)


@router.get("/cellLineUrlRoot")
def get_cell_line_url_root():
    params = {
        "label": "",
    }
    url_root = "/elara/metadata/?" + urlencode(params)

    return url_root
