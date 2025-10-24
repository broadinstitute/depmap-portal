import psutil
from celery import Celery, Task, signals
import os
import uuid
from logging import getLogger
from fastapi import HTTPException

from breadbox.logging import GCPExceptionReporter
from breadbox.celery_task.utils import check_celery
from breadbox.utils.debug_event_log import log_event, _get_log_filename

from ..config import Settings, get_settings
from pydantic import ValidationError

breadbox_env = os.getenv("BREADBOX_ENV", "dev")


log = getLogger(__name__)
exception_reporter = GCPExceptionReporter(
    service="breadbox-celery", env_name=breadbox_env
)


class LogErrorsTask(Task):
    def delay(self, *args, **kwargs):
        """Override default behavior such that before a task is sent to the queue it checks first whether the workers are available"""
        check_celery(self.app)
        return super().delay(*args, **kwargs)

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Override the default behavior on task failure to also report to our GCP error logs."""
        # User errors should not be reported, unhandled errors should be reported.
        is_http_error = isinstance(exc, HTTPException)
        if (not is_http_error) or (500 <= exc.status_code < 600):
            # It would be nice if we could report some of the information we do have here
            # (like task_id, args, etc.) to error_reporter. However, error_reporter is really
            # only set up to log context in the format of a HTTP request.
            exception_reporter.report(request=None, status_code=None, user=None)
            super().on_failure(exc, task_id, args, kwargs, einfo)


app = Celery(
    "breadbox-celery",
    include=[
        "breadbox.compute.analysis_tasks",
        "breadbox.compute.download_tasks",
        "breadbox.compute.site_check_task",
        "breadbox.compute.dataset_uploads_tasks",
    ],
)

# Add prefix to celery so Breadbox celery tasks triggered by the portal use the correct celery
# worker. Solution found at https://stackoverflow.com/a/71704583
app.conf.broker_transport_options = {"global_keyprefix": "breadbox"}


def _get_rss():
    process = psutil.Process(os.getpid())
    return process.memory_info().rss


try:
    settings = get_settings()
except ValidationError:
    log.warning(
        "Could not load settings used to set up celery, so leaving unconfigured"
    )
    settings = None

if settings is not None:
    if settings.brokerless_celery_for_testing:
        storage_configuration = dict(
            broker_url="memory://",
            result_backend="cache+memory://",
            task_always_eager=True,
            task_store_eager_result=True,
        )
    else:
        rhost = os.getenv("REDIS_HOST", "localhost")

        storage_configuration = dict(
            broker_url="redis://" + rhost, backend="redis://" + rhost,
        )
    app.conf.update(**storage_configuration)  # pyright: ignore

# Set up task logging using Celery signals
@signals.task_prerun.connect
def task_prerun_handler(task_id, task, *args, **kwargs):
    log_filename = _get_log_filename()
    if log_filename:
        # Generate a readable task name
        task_name = task.name if hasattr(task, 'name') else str(task)
        # Log task start
        log_event(log_filename, "start", task_id, {"n": f"Task {task_name}"})

@signals.task_success.connect
def task_success_handler(result, **kwargs):
    log_filename = _get_log_filename()
    if log_filename:
        task_id = kwargs.get('sender').request.id
        # Log task success
        log_event(log_filename, "end", task_id, {"s": "success"})

@signals.task_failure.connect
def task_failure_handler(task_id, exception, **kwargs):
    log_filename = _get_log_filename()
    if log_filename:
        # Log task failure
        log_event(log_filename, "end", task_id, {"s": "error", "e": str(exception)})

if __name__ == "__main__":
    app.start()
