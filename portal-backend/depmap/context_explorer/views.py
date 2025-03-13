from flask import Blueprint, render_template

blueprint = Blueprint(
    "context_explorer",
    __name__,
    url_prefix="/context_explorer",
    static_folder="../static",
)


@blueprint.route("/")
def view_context_explorer():
    return render_template("context_explorer/index.html")
