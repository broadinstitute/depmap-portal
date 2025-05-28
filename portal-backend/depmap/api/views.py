from flask import Blueprint
from flask_restplus import Resource

from depmap.api.models import ApiWithUrlScheme
from depmap.celery_task.api import namespace as celery_namespace
from depmap.download.api import namespace as download_namespace
from depmap.extensions import csrf_protect, restplus_handle_exception
from depmap.health_check.api import namespace as health_check_namespace
from depmap.context_explorer.api import namespace as context_explorer_namespace
from depmap.dataset_manager.api import namespace as dataset_manager_namespace
from depmap.data_page.api import namespace as data_page_namespace
from depmap.predictability_prototype.api import (
    namespace as predictability_prototype_namespace,
)

"""
Endpoints that are user-facing should go in in api.py files. Their blueprints are imported here
"""

blueprint = Blueprint("api", __name__, url_prefix="/api")


api = ApiWithUrlScheme(
    blueprint,
    validate=True,
    decorators=[csrf_protect.exempt],
    title="DepMap APIs",
    version="1.0",
    description="These APIs are experimental and may change without notice.",
)
api.errorhandler(restplus_handle_exception)

api.add_namespace(predictability_prototype_namespace)
api.add_namespace(data_page_namespace)
api.add_namespace(context_explorer_namespace)
api.add_namespace(health_check_namespace)
api.add_namespace(celery_namespace)
api.add_namespace(download_namespace)
api.add_namespace(dataset_manager_namespace)


@api.route("/error")
@api.doc(False)
class ErrorEndpoint(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the class name
    @api.doc(description="Exists solely to test error reporting in application")
    def get(self):
        raise Exception("An exception was generated via /api/error")
