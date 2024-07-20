from fastapi import APIRouter
from celery.result import AsyncResult

from breadbox.celery_task.utils import format_task_status
from ..compute.celery import app

router = APIRouter(prefix="/api", tags=["api"])


@router.get("/task/{id}", operation_id="get_task_status")
def get_task_status(id):
    # This is the common endpoint that should be used for polling the status of all celery tasks

    # get the task by creating an AsyncResult with the task id
    task = AsyncResult(id, app=app)

    return format_task_status(task)
