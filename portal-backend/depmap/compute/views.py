import logging

from flask import Blueprint, render_template, request
from flask_restplus import Api, Resource

from depmap.celery_task.utils import task_response_model
from depmap.extensions import csrf_protect, restplus_handle_exception
from depmap_compute.models import AnalysisType

blueprint = Blueprint(
    "compute", __name__, url_prefix="/compute", static_folder="../static"
)

restplus = Api(
    blueprint,
    validate=True,
    decorators=[
        csrf_protect.exempt
    ],  # required, else 400s saying csrf token is missing
    title="Internal restplus endpoints",
    version="1.0",
    description="These are endpoints that use restplus to better document and define contracts. This is not a user-facing interface.",
)
restplus.errorhandler(Exception)(restplus_handle_exception)

log = logging.getLogger(__name__)


@blueprint.route("/ui")
def ui():
    return render_template("compute/ui.html")

