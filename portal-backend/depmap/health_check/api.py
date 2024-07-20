from flask_restplus import Namespace, Resource
from depmap.celery_task.utils import task_response_model
from depmap.health_check import site_check_task
from depmap.celery_task.utils import format_task_status


namespace = Namespace(
    "health_check",
    description="Probe health of site, including status of celery worker and redis.",
)


@namespace.route("/celery_redis_check")
class CeleryTaskCheck(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    @namespace.doc(
        description="Check celery task. Wait on task to complete to verify round trip to celery and back is working."
    )
    @namespace.marshal_with(namespace.model("Task", task_response_model))
    def get(self):
        """
        Test celery
        """
        task = site_check_task.task_health_check.delay()
        task.wait(timeout=60, interval=0.5)

        return format_task_status(task)
