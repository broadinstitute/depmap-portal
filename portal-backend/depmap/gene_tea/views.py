from flask import (
    Blueprint,
    render_template,
    abort,
    current_app,
)


# TODO: Do we want the route to be gene_tea or genetea?
blueprint = Blueprint(
    "gene_tea", __name__, url_prefix="/gene_tea", static_folder="../static"
)


@blueprint.route("/")
def view_gene_tea():
    if not current_app.config["ENABLED_FEATURES"].gene_tea_portal_page:
        abort(404)
    return render_template("gene_tea/index.html")
