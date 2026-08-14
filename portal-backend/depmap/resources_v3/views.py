from flask import Blueprint, render_template


blueprint = Blueprint(
    "resources_v3", __name__, url_prefix="/resources-v3", static_folder="../static"
)


@blueprint.route("/")
def index():
    return render_template("resources_v3/index.html")
