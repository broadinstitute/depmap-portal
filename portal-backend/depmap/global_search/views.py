from flask import Blueprint, jsonify
from depmap.global_search.models import GlobalSearchIndex
from depmap.extensions import cache_without_user_permissions

blueprint = Blueprint(
    "search", __name__, url_prefix="/search", static_folder="../static"
)


@blueprint.route("/<text>")
@cache_without_user_permissions()
def global_search(text):
    top_hits = (
        GlobalSearchIndex.query.filter(GlobalSearchIndex.label.startswith(text))
        .order_by(GlobalSearchIndex.label)
        .limit(20)
        .all()
    )
    return jsonify([hit.format_for_dropdown() for hit in top_hits])
