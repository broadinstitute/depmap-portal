import logging
from flask import (
    Blueprint,
    render_template,
)


log = logging.getLogger(__name__)

blueprint = Blueprint(
    "groups", __name__, url_prefix="/groups", static_folder="../static",
)


@blueprint.route("/")
def view_groups_manager():
    """
    Entry point for groups manager
    """
    return render_template("groups_manager/index.html")
