import logging
from flask import Blueprint, render_template, current_app, abort


log = logging.getLogger(__name__)

blueprint = Blueprint(
    "groups", __name__, url_prefix="/groups", static_folder="../static",
)


@blueprint.route("/")
def view_groups_manager():
    """
    Entry point for groups manager
    """
    if current_app.config["ENABLED_FEATURES"].is_public():
        abort(404)
    return render_template("groups_manager/index.html")
