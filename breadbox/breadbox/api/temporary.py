from typing import Any, Annotated

from fastapi import APIRouter, Body, Depends

from breadbox.db.session import SessionWithUser
from breadbox.config import Settings, get_settings
from breadbox.crud import dataset as dataset_crud
from breadbox.crud import slice as slice_crud
from breadbox.schemas.context import Context, ContextSummary, ContextMatchResponse
from breadbox.api.dependencies import get_db_with_user

# This temporary prefix is intended to convey to API users that these contracts may change.
# Most of these endpoints are intended to support feature-specific functionality
router = APIRouter(prefix="/temporary", tags=["temporary"])


@router.post(
    "/context",
    operation_id="evaluate_context",
    response_model=ContextMatchResponse,
    response_model_exclude_none=False,
)
def evaluate_context(
    db: Annotated[SessionWithUser, Depends(get_db_with_user)],
    settings: Annotated[Settings, Depends(get_settings)],
    context: Annotated[
        Context, Body(description="A Data Explorer 2 context expression")
    ],
):
    """
    Get the full list of IDs and labels (in any dataset) which match the given context.
    Requests may be made in either the old or new format. 
    """
    # Evaluate each of the dimension's given_ids against the context
    matching_ids, matching_labels = slice_crud.get_ids_and_labels_matching_context(
        db, settings.filestore_location, context
    )

    return ContextMatchResponse(ids=matching_ids, labels=matching_labels,)


@router.post(
    "/context/summary",
    operation_id="get_context_summary",
    response_model=ContextSummary,
    response_model_exclude_none=False,
)
def get_context_summary(
    db: Annotated[SessionWithUser, Depends(get_db_with_user)],
    settings: Annotated[Settings, Depends(get_settings)],
    context: Annotated[
        Context, Body(description="A Data Explorer 2 context expression")
    ],
):
    """
    Get the number of matching labels and candidate labels.
    "Candidate" labels are all labels belonging to the context's dimension type.
    Requests may be made in either the old or new format. 
    """
    dimension_type = (
        context.dimension_type if context.dimension_type else context.context_type
    )
    all_labels_by_id = dataset_crud.get_dimension_labels_by_id(db, dimension_type)

    # Evaluate each of the dimension's given_ids against the context
    ids_matching_context, _ = slice_crud.get_ids_and_labels_matching_context(
        db, settings.filestore_location, context
    )

    return ContextSummary(
        num_candidates=len(all_labels_by_id.keys()),
        num_matches=len(ids_matching_context),
    )
