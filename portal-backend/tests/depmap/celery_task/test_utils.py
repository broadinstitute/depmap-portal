import os
import json
import pytest
from typing import Any
from dataclasses import dataclass
from depmap.celery_task.utils import format_task_status
from depmap.utilities.exception import UserError, CeleryException


@dataclass
class MockTask:
    state: str
    result: Any
    id: str = "test id"


def test_format_task_status_pending(app):
    task = MockTask("PENDING", None)
    expected = {
        "id": "test id",
        "state": "PENDING",
        "message": None,
        "percentComplete": None,
        "nextPollDelay": 1000,
        "result": None,
    }
    assert format_task_status(task) == expected


def test_format_task_status_progress_no_meta(app):
    task = MockTask("PROGRESS", None)
    expected = {
        "id": "test id",
        "state": "PROGRESS",
        "message": None,
        "percentComplete": None,
        "nextPollDelay": 1000,
        "result": None,
    }
    assert format_task_status(task) == expected


def test_format_task_status_progress_message(app):
    task = MockTask("PROGRESS", {"message": "test message"})
    expected = {
        "id": "test id",
        "state": "PROGRESS",
        "message": "test message",
        "percentComplete": None,
        "nextPollDelay": 1000,
        "result": None,
    }
    assert format_task_status(task) == expected


def test_format_task_status_progress_start_time(app):
    task = MockTask("PROGRESS", {"start_time": 0, "max_time": 60})
    expected = {
        "id": "test id",
        "state": "PROGRESS",
        "message": None,
        "percentComplete": 95,  # stalls at 95
        "nextPollDelay": 1000,
        "result": None,
    }
    assert format_task_status(task) == expected


def test_format_task_status_success(app):
    task = MockTask("SUCCESS", {"absolutely": "anything", "goes": "here"})
    expected = {
        "id": "test id",
        "state": "SUCCESS",
        "message": None,
        "percentComplete": None,
        "nextPollDelay": 1000,
        "result": {"absolutely": "anything", "goes": "here"},
    }
    assert format_task_status(task) == expected


def test_format_task_status_success_data_json_file_path(app, tmpdir):
    test_dict = {"any": "arbitrary", "data": 1, "can go": "here"}
    file_path = os.path.join(tmpdir, "test.json")
    with open(file_path, "wt") as fd:
        fd.write(json.dumps(test_dict))

    task = MockTask("SUCCESS", {"data_json_file_path": file_path})
    expected = {
        "id": "test id",
        "state": "SUCCESS",
        "message": None,
        "percentComplete": None,
        "nextPollDelay": 1000,
        "result": {"data": test_dict},
    }
    assert format_task_status(task) == expected


@pytest.mark.parametrize("celery_task_status", [("PROGRESS"), ("FAILURE"),])
def test_format_task_status_failure_user_error(app, celery_task_status):
    task = MockTask(celery_task_status, UserError("message to show user"))
    expected = {
        "id": "test id",
        "state": "FAILURE",
        "message": "message to show user",
        "percentComplete": None,
        "nextPollDelay": 1000,
        "result": None,
    }
    assert format_task_status(task) == expected


@pytest.mark.parametrize("celery_task_status", [("PROGRESS"), ("FAILURE"),])
def test_format_task_status_failure_unexpected_error(app, celery_task_status):
    error_message = "This is an unexpected error that should be thrown"
    task = MockTask(celery_task_status, ValueError(error_message))

    with pytest.raises(CeleryException):
        format_task_status(task)
