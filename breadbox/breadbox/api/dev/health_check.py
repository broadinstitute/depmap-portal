from fastapi import APIRouter, status
from breadbox.compute import site_check_task
from breadbox.celery_task.utils import format_task_status
from breadbox.schemas.custom_http_exception import HTTPError

import logging

router = APIRouter(prefix="/health_check", tags=["health_check"])

log = logging.getLogger(__name__)


@router.get("/basic", operation_id="basic_check")
def basic_check():
    return {"message": "ok"}


@router.get("/ok", operation_id="ok")
def ok():
    task = site_check_task.is_ok.delay()
    task.wait(timeout=60, interval=0.5)

    return format_task_status(task)
