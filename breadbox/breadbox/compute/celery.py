from celery import Celery, Task
import os
from logging import getLogger
from fastapi import HTTPException

from breadbox.logging import GCPExceptionReporter
from breadbox.celery_task.utils import check_celery


rhost = os.getenv("REDIS_HOST", "localhost")
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
    broker_url="redis://" + rhost,
    backend="redis://" + rhost,
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

if __name__ == "__main__":
    app.start()
