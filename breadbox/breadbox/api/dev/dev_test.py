from fastapi import APIRouter, status
from breadbox.compute import site_check_task
from breadbox.celery_task.utils import format_task_status
from breadbox.schemas.custom_http_exception import HTTPError

import logging

router = APIRouter(prefix="/dev_test", tags=["dev_test"])

log = logging.getLogger(__name__)


@router.get("/log-test", operation_id="log_test")
def log_test():
    log.error("error message")
    log.warning("warning message")
    log.info("info message")
    log.debug("debug message")
    return {"message": "ok"}


@router.get("/simulate-error", operation_id="simulate_error")
def simulate_error():
    raise Exception("Simulated error")
