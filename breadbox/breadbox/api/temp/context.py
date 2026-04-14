from typing import Annotated
from logging import getLogger
from fastapi import Body, Depends

from breadbox.crud.dimension_ids import get_dimension_type_labels_by_id
from breadbox.api.dependencies import get_db_with_user
from breadbox.config import Settings, get_settings
from breadbox.schemas.custom_http_exception import UserError
from breadbox.db.session import SessionWithUser
from breadbox.schemas.context import (
    Context,
    ContextMatchResponse,
)
from breadbox.service import slice as slice_service

from breadbox.depmap_compute_embed.context import ContextEvaluator

from .router import router

log = getLogger(__name__)


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

    def slice_loader(slice_query):
        return slice_service.get_slice_data(
            db, settings.filestore_location, slice_query
        )

    def label_loader(dimension_type):
        return get_dimension_type_labels_by_id(db, dimension_type)

    try:
        evaluator = ContextEvaluator(context.dict(), slice_loader, label_loader)
        result = evaluator.evaluate()
    except LookupError as e:
        raise UserError(f"Encountered lookup error: {e}") from e
    except (ValueError, TypeError) as e:
        log.error(
            "Context evaluation failed: %s\nContext: %s",
            e,
            context.model_dump_json(indent=2),
        )
        raise UserError(f"Context evaluation error: {e}") from e

    return ContextMatchResponse(
        ids=result.ids, labels=result.labels, num_candidates=result.num_candidates,
    )
