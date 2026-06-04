from celery.worker.control import time_limit
from pydantic import BaseModel
from typing import Annotated, Optional

from .router import router
from fastapi import APIRouter, Body, Depends, HTTPException
from breadbox.api.dependencies import get_db_with_user
from breadbox.crud import dataset as dataset_crud
from breadbox.schemas.custom_http_exception import ResourceNotFoundError
from ...config import get_settings, Settings
from ...db.session import SessionWithUser
from ...service.sql import generate_simulated_schema, execute_sql_in_virtual_db
from fastapi.responses import PlainTextResponse, FileResponse
from ...celery_task import utils
import asyncio
from ...compute.sql import execute_sql_in_virtual_db_task
from celery.exceptions import TimeLimitExceeded


class CSVFileResponse(FileResponse):
    media_type = "text/csv"


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


MAX_PENDING_SQL_QUERIES = 5
SQL_QUERY_TIMELIMIT = 30
semaphore = asyncio.Semaphore(MAX_PENDING_SQL_QUERIES)

from contextlib import contextmanager, asynccontextmanager
from fastapi.responses import JSONResponse


@asynccontextmanager
async def _concurrency_guard():
    """
    Used to ensure that we are not running too many queries in parallel. If we see we're executing more than MAX_PENDING_SQL_QUERIES
    will yield a response that the caller should return so the client knows they should try again later.
    """
    try:
        await asyncio.wait_for(semaphore.acquire(), timeout=0.1)
    except asyncio.TimeoutError:
        # If we couldn't obtain the semaphore (meaning we've used up our quota) then return the response saying
        # to try again later
        yield JSONResponse(
            status_code=503,
            headers={"Retry-After": f"{SQL_QUERY_TIMELIMIT + 5}"},
            content={
                "detail": "Service is currently executing too many other SQL queries. Try again later"
            },
        )
        return

    # otherwise proceed
    try:
        # let the control flow return to the block inside the 'with' passing back None to indicate it can proceed
        yield None
    finally:
        # and release the semaphore
        semaphore.release()


import anyio.to_thread
from typing import Any


async def _run_time_bounded_celery_task(
    task_fn: Any, args: list, time_limit: int, time_limit_padding=5
):
    """
    Run a celery task, setting a time limit on its execution. Technically, this function may take up
    to time_limit + time_limit_padding to complete. Also, if the celery queue is full, the task might
    not actually get any chance to run before the time limit expires. Regardless, this is a way to at
    least enforce some bound on the execution time of a function.
    """
    task = task_fn.apply_async(args=args, time_limit=time_limit)

    # run the get() in an executor so that this coroutine can yield to any other requests
    result = await anyio.to_thread.run_sync(
        lambda: task.get(timeout=time_limit + time_limit_padding)
    )

    return result


@router.post("/sql/query", operation_id="query_sql", response_class=CSVFileResponse)
async def query_sql(
    query: SqlQuery,
    db: SessionWithUser = Depends(get_db_with_user),
    settings: Settings = Depends(get_settings),
):
    if not settings.sql_endpoints_enabled:
        raise HTTPException(403, "SQL endpoints not enabled in this environment")

    async with _concurrency_guard() as _response:
        if _response is not None:
            response = _response
        else:
            results_dir = settings.get_todays_result_dir()

            output_file = None
            try:
                output_file = await _run_time_bounded_celery_task(
                    execute_sql_in_virtual_db_task,
                    [db.user, results_dir, query.sql, settings.filestore_location],
                    time_limit=SQL_QUERY_TIMELIMIT,
                )
            except TimeLimitExceeded:
                response = JSONResponse(
                    status_code=504,
                    content={
                        "detail": "The SQL query took too long to execute and was terminated"
                    },
                )

            if output_file is not None:
                assert isinstance(output_file, str)
                response = CSVFileResponse(output_file)

    return response
