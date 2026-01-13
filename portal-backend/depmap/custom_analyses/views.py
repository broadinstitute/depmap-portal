from flask import Blueprint, render_template

blueprint = Blueprint(
    "custom_analyses",
    __name__,
    url_prefix="/custom_analyses",
    static_folder="../static",
)


@blueprint.route("/")
def view_custom_analyses():
    """
    Entry point
    """
    return render_template("custom_analyses/index.html")
