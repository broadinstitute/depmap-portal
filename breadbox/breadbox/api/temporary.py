from typing import Any, Annotated

from fastapi import APIRouter, Body, Depends, HTTPException

from depmap_compute.context import ContextEvaluator

from breadbox.db.session import SessionWithUser
from breadbox.config import Settings, get_settings
from breadbox.crud import dataset as dataset_crud
from breadbox.crud import slice as slice_crud
from breadbox.io import filestore_crud
from breadbox.models.dataset import MatrixDataset, TabularDataset
from breadbox.schemas.context import Context, ContextSummary
from breadbox.api.dependencies import get_db_with_user, get_user

# This temporary prefix is intended to convey to API users that these contracts may change.
# Most of these endpoints are intended to support feature-specific functionality
router = APIRouter(prefix="/temporary", tags=["portal"])


@router.post(
    "/context/summary",
    operation_id="get_context_summary",
    response_model=ContextSummary,
    response_model_exclude_none=False,
)
def get_context_summary(
    db: Annotated[SessionWithUser, Depends(get_db_with_user)],
    user: Annotated[str, Depends(get_user)],
    context: Annotated[
        Context, Body(description="A Data Explorer 2 context expression")
    ],
):
    """
    Get the number of matching labels and candidate labels.
    "Candidate" labels are all labels belonging to the context's dimension type.
    This implementation only supports the "version 2" format of contexts.
    """
    # TODO: support either context type
    all_labels_by_id = dataset_crud.get_dimension_labels_by_id(
        db, context.dimension_type
    )

    # Evaluate each of the dimension's given_ids against the context
    ids_matching_context, _ = slice_crud.get_ids_and_labels_matching_context(
        db, context.dict()
    )

    return ContextSummary(
        num_candidates=len(all_labels_by_id.keys()),
        num_matches=len(ids_matching_context),
    )
