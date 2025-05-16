from celery import Celery, Task
import os
import traceback
from logging import getLogger

from google.cloud import error_reporting



class GCPExceptionReporter: # TODO: move this to some shared location to avoid 3x duplication
    def __init__(self, env: str):
        self.service_name = "breadbox-worker-" + env
        self.client = self._create_client() if not env == "dev" else None

    @property
    def disabled(self):
        return self.client is None

    def _create_client(self):
        return error_reporting.Client(service=self.service_name)

    def report(self):
        print("---- Error reported to GCS is:")
        print(traceback.format_exc())
        if self.client is None:
            print("Error reporting disabled")
            return

        self.client.report_exception(http_context=None, user=None) # From within celery, we don't know anything about the context


rhost = os.getenv("REDIS_HOST", "localhost")
breadbox_env = os.getenv("BREADBOX_ENV", "dev")

log = getLogger(__name__)
exception_reporter = GCPExceptionReporter(env=breadbox_env)

class LogErrorsTask(Task):
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Override the default behavior on task failure to also report to our GCP error logs""" 
        print("ON FAILURE (celery)") # WOOO! It gets here
        exception_reporter.report()
        super(LogErrorsTask, self).on_failure(exc, task_id, args, kwargs, einfo)


app = Celery(
    "breadbox-worker",
    broker_url="redis://" + rhost,
    backend="redis://" + rhost,
    include=[
        "breadbox.compute.analysis_tasks",
        "breadbox.compute.download_tasks",
        "breadbox.health_check.health_check",
        "breadbox.compute.dataset_uploads_tasks",
    ],
)

# Add prefix to celery so Breadbox celery tasks triggered by the portal use the correct celery
# worker. Solution found at https://stackoverflow.com/a/71704583
app.conf.broker_transport_options = {"global_keyprefix": "breadbox"}

if __name__ == "__main__":
    app.start()
