from flask import abort, Blueprint, current_app, render_template

blueprint = Blueprint(
    "anchor_screen_dashboard",
    __name__,
    url_prefix="/anchor_screen_dashboard",
    static_folder="../static",
)


@blueprint.route("/")
def view_anchor_screen_dashboard():
    """
    Entry point
    """
    if not current_app.config[
        "ENABLED_FEATURES"
    ].anchor_and_resistance_screen_dashboards:
        abort(404)

    return render_template("anchor_screen_dashboard/index.html")
