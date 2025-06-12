from dataclasses import dataclass
from enum import Enum
import json
import time
from typing import Any, Dict, Optional
from celery import current_app as current_celery_app
import celery
from celery.result import AsyncResult
from breadbox.schemas.custom_http_exception import FileValidationError
from ..compute.celery import app
from fastapi import HTTPException
from typing import Any, Optional
from ..compute.celery import app
from breadbox.schemas.custom_http_exception import UserError, CeleryConnectionError
from typing import Protocol, cast, Callable
from celery.result import AsyncResult, EagerResult

from ..celery_task.exception import CeleryException

from ..config import get_settings


class TaskState(Enum):
    PENDING = "PENDING"
    PROGRESS = "PROGRESS"
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"


from celery.app.base import Celery
import typing


def get_current_celery_app() -> Celery:
    # in reality current_celery_app is a Proxy to an instance of Celery, however,
    # as a result pyright cannot reason about the types of the Proxy's members, so
    # pretend it's an instance of Celery for pyright's sake
    return typing.cast(Celery, current_celery_app)


@dataclass
class TaskResponse:
    state: str
    id: str
    nextPollDelay: int
    message: str
    result: Optional[Any]
    percentComplate: Optional[int]


def create_celery():
    celery_app = get_current_celery_app()
    celery_app.config_from_object(get_settings(), namespace="CELERY")

    return celery_app


class CeleryProxy(Protocol):
    def delay(*args, **kwargs) -> AsyncResult:
        ...

    def apply(*args, **kwargs) -> EagerResult:
        ...


def cast_celery_task(fn: Callable[..., Any]) -> CeleryProxy:
    """
    This function exists to make the type checker happy. It takes a celery task function which 
    was decorated with @task and returns that same object, but this function is typed so that 
    the type checker knows the additional properties it has. Probably would be better to add
    typing to @task, but not sure how to do that correctly, so doing this as a bandaid.
    """
    assert hasattr(fn, "delay")
    assert hasattr(fn, "apply")
    return cast(CeleryProxy, fn)


def format_task_status(task):
    """
    This is split out from the common status endpoint because the submission endpoints also call this to return the standardized contract
        restplus endpoints that use marshal_with (i.e. the status endpoint) should just return this (the dictionary, not jsonified)

    This is called
        - by the common endpoint get_task (checks status)
        - by the various endpoints for task submission, as a first return before it starts polling get_task

    Returns the current status of the task
        A task may provide a "data_json_file_path" key in the final result.
            If so, this endpoint reads this json file and sends it under the "data" key of results
        A task may provide a "start_time" key to the meta parameter of update_state
            If so, this endpoint will compute a fake status bar

    Notes about task.result
    task.result has different things under different circumstances
        - if PROGRESS,
            contains the dictionary passed to the meta paramater when in task.py the task called self.update_state(state=..., meta=...)
            if meta= has not been updated, is None
        - if SUCCESS, contains what the task.py entry function returned
        - if FAILURE, contains the exception object thrown
    task.result is dynamically computed on the celery side
        thus, when setting a breakpoint, asking for task.result at multiple time points may change as the task moves from progress to success/failed
    """
    # depending on the state of the task, report different things back to the front end
    message = None
    percent_complete = None
    # result is always None until success
    result = None
    if task.state == TaskState.FAILURE.name or isinstance(task.result, Exception):
        # This if block is first, before the others. This is because celery sometimes we'll return an exception in the result while the status is still PROGRESS.
        if task.state != TaskState.FAILURE.name:
            # sometimes we get an error while the celery state is still progress
            task._state = TaskState.FAILURE.name
            if isinstance(task._result, UserError):
                message = str(task._result.detail)
        if isinstance(task.result, UserError):
            # this is a specific, expected error that we check for
            # return error message for the front to display
            message = str(task.result.detail)
        elif isinstance(task.result, HTTPException):
            message = {
                "status_code": str(task.result.status_code),
                "detail": str(task.result.detail),
            }
        elif isinstance(task.result, FileValidationError):
            message = str(task.result)
        else:
            # This is an unexpected error thrown while the task was running.
            # At this point, the error has already been logged in the celery error reporter
            # and should be visible in the GCS Error Groups.
            message = "Encountered an unexpected error. Please try again later."
    elif task.state == TaskState.PENDING.name:
        # pending means we have not entered the task yet
        pass
    elif task.state == TaskState.PROGRESS.name:
        # we have entered the task. if information about a message and/or start time is available,
        #   we pass the message to the front/compute a fake progress bar for the front

        # task.result contains any meta={} dict that the task might have passed to a call to update_state
        # there might have been a point where the task has updated state to PROGRESS, but did not provide any metadata
        #   at such a point, task.result is None. hence all the if statements check for task.result

        if task.result and "message" in task.result:
            message = task.result["message"]

        if task.result:
            percent_complete = task.result.get("percent_complete")
            start_time = task.result.get("start_time")

            if percent_complete is None and start_time is not None:
                # if "start_time" is provided, compute a fake status bar
                assert "max_time" in task.result
                max_percent = 95
                current_runtime = time.time() - task.result["start_time"]
                percent_complete = (
                    min(current_runtime / task.result["max_time"], 1) * max_percent
                )

    elif task.state == TaskState.SUCCESS.name:
        # done, return the result payload
        result = task.result

        if not isinstance(result, dict):
            result = result.model_dump()

        # if the "data_json_file_path" key is provided in the result payload, this endpoint reads the table and sends it to the front
        if isinstance(result, dict) and "data_json_file_path" in result:
            with open(result["data_json_file_path"], "rt") as fd:
                data = json.load(fd)
            result["data"] = data
            del result["data_json_file_path"]
    else:
        raise ValueError("Unexpected task state {}".format(task.state))

    return {  # this dictionary uses the same contract as the front end ProgressTracker component
        "id": task.id,
        "state": task.state,
        "message": message,
        "percentComplete": int(percent_complete) if percent_complete else None,
        "nextPollDelay": 1000,  # units are miliseconds, this says once per second
        "result": result,
    }


def get_task(task_id: str) -> AsyncResult:
    return AsyncResult(task_id, app=app)


def update_state(
    task: celery.Task, state=None, message: Optional[str] = None,
):
    if task is None:
        return
    if state is None and task.request is not None:
        task_result = get_task(task.request.id)
        state = task_result.state

    meta: Dict[str, Any] = {}
    if message is not None:
        meta["message"] = message

    task.update_state(state=state, meta=meta)


def check_celery():
    """
    Checks to see if celery redis broker is connected.
    Check worker stats to see if any workers are running
    """
    inspect = app.control.inspect()
    try:
        # Tries to connect to celery broker
        conn = app.broker_connection().ensure_connection(max_retries=3)
    except Exception as exc:
        raise CeleryConnectionError(
            "Failed to connect to celery redis broker!"
        ) from exc
    # Pings workers to see if any of them respond. Returns None if no response
    stats = inspect.stats()
    # NOTE: app.control.broadcast("ping", reply=True, limit=1) or inspect.ping() pings all workers but will not return if all workers are busy
    if stats is None:
        raise CeleryConnectionError(
            "Celery workers are not responding. Check if workers are running!"
        )
