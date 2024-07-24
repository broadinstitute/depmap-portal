from flask import Blueprint, render_template


blueprint = Blueprint(
    "predictability_prototype",
    __name__,
    url_prefix="/predictability_prototype",
    static_folder="../static",
)


@blueprint.route("/")
def view_predictability_prototype():
    return render_template("predictability_prototype/index.html")
