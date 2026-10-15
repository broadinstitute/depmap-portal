import asyncio
import logging
from typing import Any, Awaitable, Dict, List, Optional, TypeVar

from fastapi import Depends, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, StrictInt, ValidationError

from breadbox.api.dependencies import get_user
from breadbox.api.temp.router import router
from breadbox.config import Settings, get_settings
from breadbox.utils.strict_json import loads_strict
from breadbox.service.plot_data import (
    SUPPORTED_API_VERSIONS,
    PlotDataError,
    PlotDataService,
    internal_error,
)

log = logging.getLogger(__name__)

T = TypeVar("T")

DISCONNECT_POLL_SECONDS = 0.5


class PlotDataRequest(BaseModel):
    """
    plot_config is deliberately opaque: the Node script owns its validation (ADR 0010).
    """

    api_version: StrictInt
    plot_config: Dict[str, Any]


def plot_data_error_response(exc: PlotDataError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {"code": exc.code, "message": exc.message, "details": exc.details,}
        },
        headers=exc.headers,
    )


async def plot_data_error_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, PlotDataError)
    return plot_data_error_response(exc)


async def get_plot_data_service(
    request: Request, settings: Settings = Depends(get_settings)
) -> PlotDataService:
    # One per app, so the cache, the wait queue and the concurrency cap are shared by
    # every request. (async, so this runs on the event loop and cannot race.)
    service = getattr(request.app.state, "plot_data_service", None)
    if service is None:
        service = PlotDataService(settings)
        request.app.state.plot_data_service = service
    return service


async def read_body_capped(request: Request, limit: int) -> bytes:
    declared = request.headers.get("content-length")
    if declared is not None and declared.isdigit() and int(declared) > limit:
        raise _too_large(limit)
    chunks: List[bytes] = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > limit:
            raise _too_large(limit)
        chunks.append(chunk)
    return b"".join(chunks)


def _too_large(limit: int) -> PlotDataError:
    return PlotDataError(
        413,
        "request_too_large",
        f"The request body may be at most {limit} bytes.",
        details={"limit": limit},
    )


def parse_request(body: bytes) -> PlotDataRequest:
    try:
        doc = loads_strict(body)
    except (ValueError, RecursionError):
        raise PlotDataError(
            400, "invalid_request", "The request body is not valid JSON."
        )
    if not isinstance(doc, dict):
        raise PlotDataError(
            400, "invalid_request", "The request body must be a JSON object."
        )
    try:
        req = PlotDataRequest.model_validate(doc)
    except ValidationError as e:
        problems = "; ".join(
            f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}"
            for err in e.errors()
        )
        raise PlotDataError(400, "invalid_request", f"Invalid request: {problems}")
    if req.api_version not in SUPPORTED_API_VERSIONS:
        raise PlotDataError(
            400,
            "unsupported_api_version",
            f"api_version {req.api_version} is not supported.",
            details={"supported": sorted(SUPPORTED_API_VERSIONS)},
        )
    return req


async def run_until_disconnect(
    request: Request,
    awaitable: Awaitable[T],
    poll_seconds: float = DISCONNECT_POLL_SECONDS,
) -> Optional[T]:
    """
    Awaits `awaitable`, but cancels it (which kills the child process) if the client goes
    away first, returning None. The ASGI server does not cancel a handler on disconnect, so
    it has to be watched for.
    """
    task = asyncio.ensure_future(awaitable)
    stopped = False

    async def watch() -> None:
        # `stopped` as well as cancel(): Starlette's is_disconnected() runs inside an anyio
        # cancel scope, which can swallow a cancel() that lands mid-call.
        while not stopped:
            if await request.is_disconnected():
                return
            await asyncio.sleep(poll_seconds)

    watcher = asyncio.ensure_future(watch())
    try:
        await asyncio.wait({task, watcher}, return_when=asyncio.FIRST_COMPLETED)
        if task.done():
            return task.result()
        return None
    finally:
        stopped = True
        watcher.cancel()
        if not task.done():
            task.cancel()
        # let the cancellation finish (the child is reaped inside it)
        await asyncio.gather(task, return_exceptions=True)
        await asyncio.wait({watcher}, timeout=5)


def _assert_user_may_call(user: str, settings: Settings) -> None:
    # Same temporary throttle as the SQL endpoints: on the public portal only the MCP service
    # account may call, so the open internet cannot start Node processes. Elsewhere the
    # setting is None and everyone is allowed. (It will go away once individual users can be
    # rate-limited.)
    allowed = settings.restrict_sql_endpoint_access_to_user
    if allowed is not None and allowed != user:
        raise PlotDataError(
            403, "forbidden", "This endpoint is not enabled for this user."
        )


# Hidden from the OpenAPI docs: this is internal plumbing for DepMap Portal clients (the MCP
# server), so it is not advertised, and it is not part of the generated client.
@router.post("/plot-data", operation_id="get_plot_data", include_in_schema=False)
async def get_plot_data(
    request: Request,
    user: str = Depends(get_user),
    settings: Settings = Depends(get_settings),
    service: PlotDataService = Depends(get_plot_data_service),
):
    """
    Build the data behind a Data Explorer plot config by running the standalone
    plot-data Node script (ADR 0010) as the calling user.
    """
    _assert_user_may_call(user, settings)
    try:
        body = await read_body_capped(request, settings.plot_data_max_request_bytes)
        req = parse_request(body)
        result = await run_until_disconnect(
            request, service.run(user, req.plot_config, req.api_version)
        )
    except PlotDataError:
        raise
    except Exception as e:
        log.exception("plot-data: unexpected failure")
        raise internal_error(f"unexpected {type(e).__name__}") from e

    if result is None:
        # nobody is listening; the child has been killed
        return Response(status_code=499)

    total_ms = result.timing.queue_ms + result.timing.node_ms
    return Response(
        content=result.body,
        media_type="application/json",
        headers={
            "Server-Timing": (
                f"total;dur={total_ms:.0f}, node;dur={result.timing.node_ms:.0f}, "
                f'cache;desc="{result.cache}"'
            ),
            "X-Plot-Data-Bytes": str(len(result.body)),
        },
    )
