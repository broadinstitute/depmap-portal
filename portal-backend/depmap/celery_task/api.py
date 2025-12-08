from celery.result import AsyncResult
from flask_restplus import Namespace, Resource
from depmap.compute.celery import app
from depmap.celery_task.utils import format_task_status, task_response_model

namespace = Namespace("task", description="Poll long-running tasks")


@namespace.route("/<path:id>")
class Task(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    @namespace.marshal_with(namespace.model("Task", task_response_model,))
    def get(self, id):
        # Note: docstrings to restplus methods end up in the swagger documentation.
        # This docstring is used for a short one-line description shown next to the endpoint URL. Longer descriptions should go in namespace.doc(description=)
        # DO NOT put a docstring here that you would not want exposed to users of the API. Use # for comments instead
        """
        Get the status and outcome of a task
        """
        # This is the common endpoint that should be used for polling the status of all celery tasks

        # get the task by creating an AsyncResult with the task id
        task = AsyncResult(id, app=app)

        return format_task_status(task)
