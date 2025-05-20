import logging.config
import logging
from typing import Optional

from fastapi import Request
from google.cloud import error_reporting
from pydantic import BaseModel

# based on https://stackoverflow.com/questions/63510041/adding-python-logging-to-fastapi-endpoints-hosted-on-docker-doesnt-display-api
class LogConfig(BaseModel):
    LOGGER_NAME: str = "breadbox"
    LOG_FORMAT: str = "%(levelprefix)s | %(asctime)s | %(message)s"
    LOG_LEVEL: str = "INFO"

    # Logging config
    version: int = 1
    disable_existing_loggers: bool = False
    formatters: dict = {
        "default": {
            "()": "uvicorn.logging.DefaultFormatter",
            "fmt": LOG_FORMAT,
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
    }
    handlers: dict = {
        "default": {
            "formatter": "default",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stderr",
        },
    }
    loggers: dict = {
        LOGGER_NAME: {"handlers": ["default"], "level": LOG_LEVEL},
    }


def configure_logging():
    logging.config.dictConfig(LogConfig().dict())


class GCPExceptionReporter:
    def __init__(self, service: str, env_name: str):
        self.service_name = f"{service}-{env_name}"
        self.client = self._create_client() if not env_name == "dev" else None

    @property
    def disabled(self):
        return self.client is None

    def _create_client(self):
        return error_reporting.Client(service=self.service_name)

    def _create_http_context(self, request: Request, status_code: int):
        breadbox_http_context = error_reporting.HTTPContext(
            method=request.scope["method"],
            url=request.scope["root_path"] + request.scope["path"],
            response_status_code=status_code,
        )
        return breadbox_http_context

    def report(self, request: Optional[Request], status_code: Optional[int], user: Optional[str]):
        if self.client is None:
            print("Error reporting disabled")
            return
        
        if request and status_code:
            http_context = self._create_http_context(request, status_code)
        else:
            # When errors are thrown from within celery, there will be no request context
            http_context = None

        self.client.report_exception(http_context=http_context, user=user)

