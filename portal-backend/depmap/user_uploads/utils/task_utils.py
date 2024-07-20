from dataclasses import dataclass
from io import BytesIO
from typing import Any

import requests
from celery.result import AsyncResult
import datetime
import os
from flask import current_app
from depmap.compute.celery import app
import os.path
from depmap.utilities.exception import FileTooLarge
import uuid
from werkzeug.datastructures import FileStorage
import typing
import requests


@dataclass
class UploadTaskStatus(object):
    task_id: str
    status: str
    result: Any


def get_task(task_id: str) -> AsyncResult:
    return AsyncResult(task_id, app=app)


def get_current_result_dir():
    # this format is aligned with the clean up job code, clean_compute_results.py in the depmap-deploy repo
    # if this is changed, or the results territory starts using something else, the cleaning code needs to be changed too
    current_day = str(datetime.datetime.now().strftime("%Y%m%d"))

    result_dir = os.path.join(current_app.config["COMPUTE_RESULTS_ROOT"], current_day)
    return result_dir


def write_url_to_local_file(url: str):
    response = requests.get(url, stream=True)
    return write_fileobj_to_local_file(response.raw)


def write_fileobj_to_local_file(fileobj: typing.IO):
    # create a temp directory to hold uploaded file
    result_dir = os.path.join(get_current_result_dir(), str(uuid.uuid4()))
    os.makedirs(result_dir)

    local_filename = os.path.join(result_dir, "uploaded.csv")
    max_upload_size = current_app.config["MAX_UPLOAD_SIZE"]
    bytes_written = 0

    with open(local_filename, "wb") as fd:
        while True:
            buffer = fileobj.read(1024 * 1024)  # read 1MB at a time (arbitrary)
            if len(buffer) == 0:  # if we reach the end, stop
                break
            bytes_written += len(buffer)
            if bytes_written > max_upload_size:
                raise FileTooLarge(bytes_written, max_upload_size)
            fd.write(buffer)

    return local_filename


def write_upload_to_local_file(upload_file: FileStorage):
    return write_fileobj_to_local_file(upload_file)
