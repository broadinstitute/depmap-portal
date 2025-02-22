from fastapi import APIRouter, status
from breadbox.health_check import site_check_task
from breadbox.celery_task.utils import format_task_status, check_celery
from breadbox.schemas.custom_http_exception import HTTPError

import logging

router = APIRouter(prefix="/health_check", tags=["health_check"])

log = logging.getLogger(__name__)


@router.get("/basic", operation_id="basic_check")
def basic_check():
    return {"message": "ok"}


@router.get("/log-test", operation_id="log_test")
def log_test():
    log.error("error message")
    log.warning("warning message")
    log.info("info message")
    log.debug("debug message")
    return {"message": "ok"}


@router.get("/ok", operation_id="ok")
def ok():
    check_celery()

    task = site_check_task.is_ok.delay()
    task.wait(timeout=60, interval=0.5)

    return format_task_status(task)


@router.get("/simulate-error", operation_id="simulate_error")
def simulate_error():
    raise Exception("Simulated error")


@router.get(
    "/celery",
    operation_id="celery_check",
    responses={status.HTTP_503_SERVICE_UNAVAILABLE: {"model": HTTPError}},
)
def celery_check():
    check_celery()

    return {"message": "ok"}
