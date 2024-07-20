from google.cloud import error_reporting
from google.cloud.error_reporting import build_flask_context
from google.cloud.logging import Client as LoggingClient
from flask import request
import os
import logging
from depmap.settings import build

try:
    from flask import _app_ctx_stack as stack  # type: ignore
except ImportError:
    from flask import _request_ctx_stack as stack  # type: ignore


def setup_logging():
    client = LoggingClient()
    client.setup_logging(logging.WARN)


class ExceptionReporter:
    def __init__(self, service_name=None, app=None):
        self.service_name = service_name
        if app is not None:
            self.init_app(app)

    def init_app(self, app, service_name=None):
        if service_name is not None:
            self.service_name = service_name
        self.disabled = not app.config["REPORT_EXCEPTIONS"]
        # disabling logging to stackdriver because calling setup_logging
        # appears to override any existing logging settings and log _only_ to
        # stack driver. In addition, log to stackdriver is different than the "error tracker"
        # so we need to decide what we want our logging strategy to be.
        # if not self.disabled:
        #     setup_logging()

    def report(self):
        if self.disabled:
            print("Reporting: error reporting disabled")
            return

        client = self._get_client()
        client.report_exception(http_context=build_flask_context(request))

    def _create_client(self):
        return error_reporting.Client(service=self.service_name, version=build.SHA)

    def _get_client(self):
        ctx = stack.top
        assert ctx is not None
        if not hasattr(ctx, "stackdriver_client"):
            ctx.stackdriver_client = self._create_client()
        return ctx.stackdriver_client
