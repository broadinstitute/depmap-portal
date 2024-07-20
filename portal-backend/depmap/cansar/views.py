from flask import Blueprint, render_template

from depmap.extensions import cansar

blueprint = Blueprint(
    "cansar", __name__, url_prefix="/cansar", static_folder="../static"
)


# The cleanest approach would have this return a json object and render the contained data in a react component,
# however, we don't yet have precident for tiles which are react components, so for now I'll render a html partial
# which we can just inject into the page.
@blueprint.route("/<uniprot_id>")
def summary(uniprot_id):
    protein = cansar.client.get_protein(uniprot_id)
    return render_template("cansar/summary.html", protein=protein)
