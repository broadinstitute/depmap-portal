from celery.worker.control import time_limit
from pydantic import BaseModel
from typing import Annotated, Optional

from .router import router
from fastapi import APIRouter, Body, Depends, HTTPException
from breadbox.api.dependencies import get_db_with_user
from breadbox.crud import dataset as dataset_crud
from breadbox.schemas.custom_http_exception import ResourceNotFoundError, UserError
from ...config import get_settings, Settings
from ...db.session import SessionWithUser
from ...service.sql import generate_simulated_schema, execute_sql_in_virtual_db
from fastapi.responses import PlainTextResponse, FileResponse, Response
from ...celery_task import utils
import asyncio
from ...compute.sql import execute_sql_in_virtual_db_task
from celery.exceptions import TimeLimitExceeded

import anyio.to_thread
from typing import Any, Callable, Awaitable

from fastapi.responses import JSONResponse
import logging

log = logging.getLogger(__name__)

MAX_PENDING_SQL_QUERIES = 5
SQL_QUERY_TIMELIMIT = 30
semaphore = asyncio.Semaphore(MAX_PENDING_SQL_QUERIES)


class CSVFileResponse(FileResponse):
    media_type = "text/csv"


async def _concurrency_guard(callback: Callable[[], Awaitable[Response]]):
    """
    Used to ensure that we are not running too many queries in parallel. If we see we're executing more than MAX_PENDING_SQL_QUERIES
    will return a response that the caller should return so the client knows they should try again later.
    """
    try:
        await asyncio.wait_for(semaphore.acquire(), timeout=0.1)
    except asyncio.TimeoutError:
        # If we couldn't obtain the semaphore (meaning we've used up our quota) then return the response saying
        # to try again later
        return JSONResponse(
            status_code=503,
            headers={"Retry-After": f"{SQL_QUERY_TIMELIMIT + 5}"},
            content={
                "detail": "Service is currently executing too many other SQL queries. Try again later"
            },
        )

    try:
        # otherwise proceed
        return await callback()
    finally:
        # and make sure to always release the semaphore
        semaphore.release()


class SqlQuery(BaseModel):
    sql: str


@router.get(
    "/sql/schema", operation_id="get_sql_schema",
)
def get_sql_schema(
    db: SessionWithUser = Depends(get_db_with_user),
    settings: Settings = Depends(get_settings),
    dataset_given_id: Optional[str] = None,
):
    """
    Return a virtual schema definition queryable by the /sql/query endpoint.
    If a dataset given ID is specified, only return a subset of the schema definition 
    (tables relevant to that dataset).
    """
    if not settings.sql_endpoints_enabled:
        raise HTTPException(403, "SQL endpoints not enabled in this environment")

    if dataset_given_id is None:
        dataset = None
    else:
        dataset = dataset_crud.get_dataset(db, db.user, dataset_id=dataset_given_id)
        if dataset is None:
            raise ResourceNotFoundError("Dataset not found")

    statements_by_given_id = generate_simulated_schema(db, dataset)
    return statements_by_given_id


class CeleryTaskTimeout(Exception):
    pass


async def _run_time_bounded_celery_task(
    task_fn: Any, args: list, time_limit: int, time_limit_padding=5
):
    """
    Run a celery task, setting a time limit on its execution. Technically, this function may take up
    to time_limit + time_limit_padding to complete. Also, if the celery queue is full, the task might
    not actually get any chance to run before the time limit expires. Regardless, this is a way to at
    least enforce some bound on the execution time of a function.
    """
    # give the task extra time in celery so that our while loop below is generally the one
    # to figure out that we've run out of time and raises the exception before the task comes back
    # as a failure
    task = task_fn.apply_async(args=args, time_limit=time_limit + time_limit_padding)

    # we previously had the following here to do a blocking wait for the task
    #
    # await anyio.to_thread.run_sync(
    #   lambda: task.get(timeout=time_limit + time_limit_padding, propagate=False)
    # )
    #
    # However, it appears this results in some non-threadsafe use of a redis connection
    # which can result in all future queries failing with an InvalidResponse exception,
    #
    # To avoid that, we're going to use a dumb polling strategy instead

    deadline = asyncio.get_event_loop().time() + time_limit
    try:
        while asyncio.get_event_loop().time() < deadline:
            if task.ready():
                if task.state == "SUCCESS":
                    return task.result
                else:
                    raise Exception(
                        f"Task {task.id} task.status was not SUCCESS (was: {task.state}) "
                    )
            await asyncio.sleep(0.5)
    except TimeLimitExceeded:
        pass  # fall through and let our custom timeout error be thrown

    raise CeleryTaskTimeout(f"Task {task.id} did not complete in time")


@router.post("/sql/query", operation_id="query_sql", response_class=CSVFileResponse)
async def query_sql(
    query: SqlQuery,
    db: SessionWithUser = Depends(get_db_with_user),
    settings: Settings = Depends(get_settings),
):
    # Implementation note: SQL queries are user-supplied and may run for an unbounded amount of
    # time, which poses a server overload risk. This is particularly acute because uvicorn handles
    # requests on a thread pool of limited size — a synchronous (non-async) function called from
    # a route handler blocks one of those threads for its entire duration. If enough slow queries
    # pile up, the thread pool is exhausted and the server becomes unable to handle any requests,
    # including unrelated ones.
    #
    # To enforce a time limit, we delegate execution to a Celery worker process via
    # execute_sql_in_virtual_db_task. A separate process is necessary because Python threads
    # cannot be forcibly terminated from outside; only OS-level process signals can reliably
    # stop runaway code. Celery's time_limit feature sends SIGKILL to the worker if it exceeds
    # the allowed time, which is the only reliable way to enforce a hard deadline on arbitrary SQL.
    #
    # Even with a per-query time limit, a burst of slow queries could fill Celery's queue faster
    # than workers can drain it, causing requests to sit pending until their time limits expire
    # without ever executing. The semaphore (MAX_PENDING_SQL_QUERIES) provides backpressure: once
    # that many queries are in-flight, new requests immediately receive a 503 rather than queuing
    # indefinitely and consuming resources while waiting.

    if not settings.sql_endpoints_enabled:
        raise HTTPException(403, "SQL endpoints not enabled in this environment")

    async def _run():
        results_dir = settings.get_todays_result_dir()

        output_file = None
        try:
            output_file = await _run_time_bounded_celery_task(
                execute_sql_in_virtual_db_task,
                [db.user, results_dir, query.sql, settings.filestore_location],
                time_limit=SQL_QUERY_TIMELIMIT,
            )
        except CeleryTaskTimeout:
            log.warning(
                f"This query took too long to executed and was aborted: {query.sql}"
            )
            return JSONResponse(
                status_code=504,
                content={
                    "detail": "The SQL query took too long to execute and was terminated"
                },
            )
        except UserError as e:
            raise
        except Exception as e:
            raise Exception(f"Exception executing sql query {query.sql}") from e

        assert isinstance(output_file, str)
        return CSVFileResponse(output_file)

    return await _concurrency_guard(_run)
