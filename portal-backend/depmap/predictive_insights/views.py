"""Dev-only manual test page for the Predictive Insights component.

Not a production entry point — renders the component standalone, driven only
by the dim_type/given_id in the URL, so it can be exercised without a real
gene/compound page wired up yet.
"""
from flask import Blueprint, render_template

blueprint = Blueprint(
    "predictive_insights", __name__, url_prefix="", static_folder="../static",
)


@blueprint.route("/test-pred-component/<dim_type>/<given_id>")
def view_test_pred_component(dim_type, given_id):
    return render_template(
        "predictive_insights/test_pred_component.html",
        dim_type=dim_type,
        given_id=given_id,
    )
