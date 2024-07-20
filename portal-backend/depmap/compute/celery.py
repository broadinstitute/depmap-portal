from celery import Celery
import os

from logging import getLogger

log = getLogger(__name__)

rhost = os.getenv("REDIS_HOST", "localhost")
app = Celery(
    "compute",
    broker="redis://" + rhost,
    backend="redis://" + rhost,
    include=["depmap.compute.analysis_tasks"],
)

if __name__ == "__main__":
    app.start()
