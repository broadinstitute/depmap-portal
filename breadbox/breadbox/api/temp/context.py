from typing import Annotated
from logging import getLogger
from fastapi import Body, Depends

from breadbox.crud.dimension_ids import get_dimension_type_labels_by_id
from breadbox.api.dependencies import get_db_with_user
from breadbox.config import Settings, get_settings
from breadbox.schemas.custom_http_exception import UserError
from breadbox.db.session import SessionWithUser
from breadbox.crud import dataset as dataset_crud
from breadbox.schemas.context import (
    Context,
    ContextDatasetCoverageResponse,
    ContextMatchResponse,
)
from breadbox.service import slice as slice_service

from breadbox.depmap_compute_embed.context import ContextEvaluator

from .router import router

log = getLogger(__name__)


def _evaluate(db: SessionWithUser, settings: Settings, context: Context):
    """Resolve a context to its matching ids, with the loaders it needs.

    Shared by the two endpoints below rather than duplicated: the loaders close
    over the request's own db session and filestore, so they cannot be hoisted
    to module scope, and having two copies invites them to drift.
    """

    def slice_loader(slice_query):
        return slice_service.get_slice_data(
            db, settings.filestore_location, slice_query
        )

    def label_loader(dimension_type):
        return get_dimension_type_labels_by_id(db, dimension_type)

    try:
        evaluator = ContextEvaluator(context.dict(), slice_loader, label_loader)
        return evaluator.evaluate()
    except LookupError as e:
        raise UserError(f"Encountered lookup error: {e}") from e
    except (ValueError, TypeError) as e:
        log.error(
            "Context evaluation failed: %s\nContext: %s",
            e,
            context.model_dump_json(indent=2),
        )
        raise UserError(f"Context evaluation error: {e}") from e


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
    result = _evaluate(db, settings, context)

    return ContextMatchResponse(
        ids=result.ids, labels=result.labels, num_candidates=result.num_candidates,
    )


@router.post(
    "/context/dataset-coverage",
    operation_id="get_context_dataset_coverage",
    response_model=ContextDatasetCoverageResponse,
    response_model_exclude_none=False,
)
def get_context_dataset_coverage(
    db: Annotated[SessionWithUser, Depends(get_db_with_user)],
    settings: Annotated[Settings, Depends(get_settings)],
    context: Annotated[
        Context, Body(description="A Data Explorer 2 context expression")
    ],
):
    """
    How many of a context's entities each visible dataset actually contains.

    Exists so a caller choosing a dataset on the user's behalf can prefer one
    that has the data. `GET /datasets/?feature_id=` answers this for a single
    entity; a context routinely names thousands, and asking per entity is a
    round trip each.

    The context is evaluated here rather than by the caller because the ids are
    only needed to be counted: returning them so they can be sent straight back
    means a large payload in both directions, and a `WHERE ... IN` built from
    whatever the client chose to send.

    Datasets with no matching entity are omitted rather than reported as zero.
    """
    result = _evaluate(db, settings, context)

    counts = dataset_crud.count_dataset_coverage(
        db, db.user, context.dimension_type, result.ids
    )

    return ContextDatasetCoverageResponse(counts=counts, total=len(result.ids))
