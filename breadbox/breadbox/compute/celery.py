from celery import Celery
import os
from logging import getLogger


log = getLogger(__name__)

rhost = os.getenv("REDIS_HOST", "localhost")
app = Celery(
    "compute",
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
