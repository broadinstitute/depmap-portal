from flask import Blueprint, redirect, render_template, url_for, current_app

blueprint = Blueprint(
    "context_explorer",
    __name__,
    url_prefix="/context_explorer",
    static_folder="../static",
)


@blueprint.route("/")
def view_context_explorer():
    if not current_app.config["ENABLED_FEATURES"].context_explorer:
        return redirect(url_for("context.view_context", context_name="Melanoma"))
    else:
        return render_template("context_explorer/index.html")
