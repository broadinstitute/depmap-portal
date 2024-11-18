from typing import Annotated

from fastapi import APIRouter, Body, Depends

from breadbox.api.dependencies import get_db_with_user
from breadbox.config import Settings, get_settings
from breadbox.crud import types as types_crud
from breadbox.schemas.custom_http_exception import UserError
from breadbox.db.session import SessionWithUser
from breadbox.schemas.context import (
    Context,
    ContextMatchResponse,
)
from breadbox.service import slice as slice_service

from depmap_compute.context import ContextEvaluator

# This temp prefix is intended to convey to API users that these contracts may change.
# Most of these endpoints are intended to support feature-specific functionality
router = APIRouter(prefix="/temp", tags=["temp"])


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
    Also get the total number of "candidate" records (all records with labels belonging to the dimension type).
    Requests must be in the version 2 context format. 
    """
    slice_loader_function = lambda slice_query: slice_service.get_slice_data(
        db, settings.filestore_location, slice_query
    )
    context_evaluator = ContextEvaluator(context.dict(), slice_loader_function)

    # Load all dimension labels and ids
    all_labels_by_id = types_crud.get_dimension_type_labels_by_id(
        db, context.dimension_type
    )

    # Evaluate each against the context
    matching_ids = []
    matching_labels = []
    try:
        for given_id, label in all_labels_by_id.items():
            if context_evaluator.is_match(given_id):
                matching_ids.append(given_id)
                matching_labels.append(label)
    except LookupError as e:
        # This happens when the request is malformed
        raise UserError(f"Encountered lookup error: {e}")

    return ContextMatchResponse(
        ids=matching_ids,
        labels=matching_labels,
        num_candidates=len(all_labels_by_id.keys()),
    )
