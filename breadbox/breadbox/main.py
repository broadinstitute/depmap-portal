from .startup import create_app, ensure_directories_exist
from .celery_task.utils import create_celery
from .config import get_settings
from breadbox.api.dependencies import get_user
from fastapi import Request, status
from fastapi.exception_handlers import (
    http_exception_handler,
)
from .logging import configure_logging, GCPExceptionReporter

configure_logging()

# Create all the singleton instances
settings = get_settings()

ensure_directories_exist(settings)
app = create_app(settings)

# create the celery breadbox used to communicate with the celery queue
celery_app = create_celery()

# it appears we might need celery_app and celery as both are imported?
# come back to this and eliminate one of these at some point.
celery = celery_app

# create the Google Cloud exception reporter class
exception_reporter = GCPExceptionReporter(service="breadbox", env_name=settings.breadbox_env)

from starlette.exceptions import HTTPException as StarletteHTTPException


@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request: Request, exc: StarletteHTTPException):
    if (exception_reporter.disabled is False) and (500 <= exc.status_code < 600):
        exception_reporter.report(request, exc.status_code, get_user(request))

    return await http_exception_handler(request, exc)


@app.exception_handler(Exception)
async def custom_exception_handler(request: Request, exc: Exception):
    exception_reporter.report(
        request, status.HTTP_500_INTERNAL_SERVER_ERROR, get_user(request)
    )
    raise exc
