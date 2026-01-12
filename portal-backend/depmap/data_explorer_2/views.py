from flask import (
    Blueprint,
    render_template,
)


blueprint = Blueprint(
    "data_explorer_2",
    __name__,
    url_prefix="/data_explorer_2",
    static_folder="../static",
)

@blueprint.route("/")
def view_data_explorer_2():
    return render_template(
        "data_explorer_2/index.html", 
        tutorial_link="https://sites.google.com/broadinstitute.org/depmap-de2-tutorial/home"
    )
