from depmap.context.models_new import SubtypeContext
from depmap.methylation.util import merge_results
from depmap.extensions import methylation_db
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
    codes = request.args.getlist("context")
    cell_lines = set()
    for code in codes:
        context = SubtypeContext.get_by_code(code)
        assert context is not None
        cell_lines.update(context.depmap_model)
    results = [
        methylation_db.connection.get(gene_symbol, cell_line.cell_line)
        for cell_line in cell_lines
    ]

    return jsonify(merge_results(results))
