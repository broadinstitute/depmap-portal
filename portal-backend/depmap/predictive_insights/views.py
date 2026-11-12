"""Dev-only manual test page for the Predictive Insights component.

Not a production entry point — renders the component standalone, driven only
by the dim_type/label in the URL, so it can be exercised without a real
gene/compound page wired up yet.
"""
from flask import Blueprint, abort, render_template

from breadbox_facade.exceptions import BreadboxException
from depmap.data_access import breadbox_dao

blueprint = Blueprint(
    "predictive_insights", __name__, url_prefix="", static_folder="../static",
)


def _label_to_given_id(dim_type, label):
    """Look up the given_id of the dimension whose "label" matches, using the
    breadbox "<dim_type>_metadata" tabular dataset (indexed by given_id)."""
    try:
        labels = breadbox_dao.get_tabular_dataset_column(
            dim_type + "_metadata", "label"
        )
    except BreadboxException:
        return None
    matches = labels[labels == label]
    if len(matches) == 0:
        return None
    return str(matches.index[0])  # pyright: ignore


@blueprint.route("/test-pred-component/<dim_type>/<label>")
def view_test_pred_component(dim_type, label):
    # just a little renaming to make the url prettier
    if dim_type == "compound":
        dim_type = "compound_v2"
    given_id = _label_to_given_id(dim_type, label)
    if given_id is None:
        abort(404)
    return render_template(
        "predictive_insights/test_pred_component.html",
        dim_type=dim_type,
        given_id=given_id,
    )
