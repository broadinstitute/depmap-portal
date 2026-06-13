from flask import Blueprint, render_template

blueprint = Blueprint(
    "transcript_explorer",
    __name__,
    url_prefix="/transcript_explorer",
    static_folder="../static",
)


@blueprint.route("/")
def view_transcript_explorer():
    """
    Entry point
    """
    return render_template("transcript_explorer/index.html")
