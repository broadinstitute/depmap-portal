from contextlib import contextmanager
from typing import Annotated, Callable, Generator, Literal
from logging import getLogger
from fastapi import Body, Depends, Query

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
import time

log = getLogger(__name__)

from breadbox.utils.profiling import profiled_region


@contextmanager
def _warn_if_slow(
    request: str, msg_builder: Callable[[], str], max_duration_seconds: float = 5
) -> Generator[None]:
    start = time.perf_counter()
    try:
        yield
    finally:
        duration = time.perf_counter() - start
        if duration > max_duration_seconds:
            try:
                log.warning("%s took %.2fs: %s", request, duration, msg_builder())
            except Exception:
                # don't let a bad msg_builder cause request to fail. Just log and move on
                log.exception("Got exception trying to generate msg for _warn_if_slow")


def _evaluate(db: SessionWithUser, settings: Settings, context: Context):
    """Resolve a context to its matching ids, with the loaders it needs.

    Shared by the two endpoints below rather than duplicated: the loaders close
    over the request's own db session and filestore, so they cannot be hoisted
    to module scope, and having two copies invites them to drift.
    """

    def slice_loader(slice_query):
        with profiled_region("slice_loader"):
            return slice_service.get_slice_data(
                db, settings.filestore_location, slice_query
            )

    def label_loader(dimension_type):
        with profiled_region("label_loader"):
            return get_dimension_type_labels_by_id(db, dimension_type)

    with profiled_region("evaluator.evaluate()"):
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
    with _warn_if_slow("evaluate_context", lambda: f"context={context}"):
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
    scope: Annotated[
        Literal["all", "public"],
        Query(
            description=(
                "Which datasets to count over. 'all' covers everything the "
                "caller may see. 'public' covers only the public group, which "
                "makes the response identical for every caller."
            )
        ),
    ] = "all",
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

    `scope=public` exists for callers that want to store the answer. A default
    `scope=all` response depends on who is asking, so a client cannot write it
    anywhere another user might read it; a public-scoped one is the same bytes
    for everyone and carries nothing private. The caller gives up coverage
    information about its private datasets to get that, which is a trade only
    it can make -- hence a parameter rather than a server-side policy.
    """
    with profiled_region("get_context_dataset_coverage"):
        with _warn_if_slow(
            "get_context_dataset_coverage", lambda: f"scope={scope} context={context}",
        ):
            with profiled_region("get_context_dataset_coverage: _evaluate"):
                result = _evaluate(db, settings, context)

            with profiled_region(
                "get_context_dataset_coverage: dataset_crud.count_dataset_coverage"
            ):
                counts = dataset_crud.count_dataset_coverage(
                    db,
                    db.user,
                    context.dimension_type,
                    result.ids,
                    public_only=(scope == "public"),
                )

            return ContextDatasetCoverageResponse(counts=counts, total=len(result.ids))
