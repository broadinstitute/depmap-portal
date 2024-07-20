from depmap.methylation.util import merge_results
from depmap.extensions import methylation_db
from depmap.context.models import Context
from flask import (
    Blueprint,
    render_template,
    jsonify,
    url_for,
    abort,
    make_response,
    request,
    current_app,
)

blueprint = Blueprint(
    "methylation", __name__, url_prefix="/methylation", static_folder="../static"
)


@blueprint.route("/<gene_symbol>")
def query_contexts(gene_symbol):
    context_names = request.args.getlist("context")
    cell_lines = set()
    for context_name in context_names:
        context = Context.get_by_name(context_name)
        cell_lines.update(context.cell_line)
    results = [
        methylation_db.connection.get(gene_symbol, cell_line)
        for cell_line in cell_lines
    ]

    return jsonify(merge_results(results))
