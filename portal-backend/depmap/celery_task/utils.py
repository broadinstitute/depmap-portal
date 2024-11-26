import time
import json
from flask import jsonify
from flask_restplus import fields
from enum import Enum

from depmap.utilities.exception import UserError, CeleryException


class TaskState(Enum):
    PENDING = "PENDING"
    PROGRESS = "PROGRESS"
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"


# can't share the namespace.Model object because it is registered to a specific namespace
task_response_model = {
    "state": fields.String(
        description="One of: {}".format(", ".join([state.name for state in TaskState])),
        required=True,
    ),
    "id": fields.String(description="ID of the started or queried task", required=True),
    "nextPollDelay": fields.Integer(
        description="Time the client should wait before the next poll to the task",
        required=True,
        example=1000,
    ),
    "message": fields.String(description="Progress or failure message", required=False),
    "result": fields.Raw(
        description="If state is SUCCESS, this contains a result, with a structure depending on the submitted task",
        required=False,
    ),
    "percentComplete": fields.Integer(
        description="Percent progress of the task", required=False
    ),
}


def format_taskless_error_message(message):
    """
    Formats an error message which has the same contract as format_task_status and is used by the ProgressTracker front end
        but with no task information
    This should be used when one encounters a UserError in the endpoint for submission of a celery task, before the task is kicked off
        E.g., if the submission task does some input validation prior to kicking off the celery task
    """
    return {"state": TaskState.FAILURE.name, "message": message}


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
            task.state = TaskState.FAILURE.name
        if isinstance(task.result, UserError):
            # this is a specific, expected error that we check for
            # return error message for the front to display
            message = str(task.result)
        else:
            # this is an unexpected error, somewhere in our code threw that exception
            # task.result contains the exception. throw it to throw a hard 500 and report to stackdriver
            print("-----")
            print(type(task.result))
            print(task.result)
            print("-----")
            raise CeleryException("Error from celery worker.") from task.result
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

            # For some reason, max time is occasionally null in tasks originating from the
            # compound page's Genomic Associations tab. For now, just use a default value instead of throwing an error.
            max_time = task.result.get("max_time", 45)

            if percent_complete is None and start_time is not None:
                # if "start_time" is provided, compute a fake status bar
                max_percent = 95
                current_runtime = time.time() - task.result["start_time"]
                percent_complete = min(current_runtime / max_time, 1) * max_percent

    elif task.state == TaskState.SUCCESS.name:
        # done, return the result payload
        result = task.result

        # if the "data_json_file_path" key is provided in the result payload, this endpoint reads the table and sends it to the front
        if "data_json_file_path" in result:
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
        "percentComplete": percent_complete,
        "nextPollDelay": 1000,  # units are miliseconds, this says once per second
        "result": result,
    }
