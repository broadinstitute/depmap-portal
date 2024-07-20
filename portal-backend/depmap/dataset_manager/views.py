import logging
from flask import Blueprint, render_template


log = logging.getLogger(__name__)

blueprint = Blueprint(
    "datasets", __name__, url_prefix="/datasets", static_folder="../static",
)


@blueprint.route("/")
def view_dataset_manager():
    """
    Entry point for dataset manager
    """
    return render_template("dataset_manager/index.html")
