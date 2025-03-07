import logging
from flask import Blueprint, render_template, current_app, abort
from depmap.extensions import breadbox


log = logging.getLogger(__name__)

blueprint = Blueprint(
    "datasets", __name__, url_prefix="/datasets", static_folder="../static",
)


@blueprint.route("/")
def view_dataset_manager():
    """
    Entry point for dataset manager
    """
    if not current_app.config["ENABLED_FEATURES"].data_manager:
        abort(404)
    return render_template("dataset_manager/index.html")
