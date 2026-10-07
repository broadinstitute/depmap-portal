from celery import Celery, signals
import os

from logging import getLogger

from depmap.telemetry import configure_celery_worker_tracing, flush_tracing

log = getLogger(__name__)

rhost = os.getenv("REDIS_HOST", "localhost")
app = Celery(
    "compute",
    broker="redis://" + rhost,
    backend="redis://" + rhost,
    include=["depmap.download.tasks"],
)



@signals.worker_process_init.connect(weak=False)
def init_celery_tracing(*args, **kwargs):
    # DEPMAP_ENV is the same variable autoapp.py uses to pick the config (it may carry a legacy
    # "<config path>:<env name>" prefix)
    env_name = os.getenv("DEPMAP_ENV", "dev").split(":")[-1]
    configure_celery_worker_tracing(service="depmap-celery", env_name=env_name)


@signals.worker_process_shutdown.connect(weak=False)
def shutdown_celery_tracing(*args, **kwargs):
    # Workers are replaced after every task (--max-tasks-per-child 1), so flush before exiting
    flush_tracing()


if __name__ == "__main__":
    app.start()
