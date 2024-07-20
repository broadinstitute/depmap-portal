from flask import Blueprint, render_template, abort, url_for, current_app

from depmap.context.models import Context
from depmap.partials.data_table.factories import get_data_table_for_view
from depmap.cell_line.models import Lineage
from depmap.database import db

blueprint = Blueprint(
    "context", __name__, url_prefix="/context", static_folder="../static"
)

# We use path: to capture context names with slashes, which can occur
# as of 22q4 (e.g. Ovary/Fallopian Tube)
@blueprint.route("/<path:context_name>")
def view_context(context_name):
    context = Context.get_by_name(context_name, must=False)
    if context is None:
        abort(404)
    lineage_links = []
    if db.session.query(Lineage.name).filter_by(name=context_name).first():
        if len(context.cell_line) > 0:
            lineages = sorted(context.cell_line[0].lineage.all(), key=lambda x: x.level)
            for lineage in lineages:
                if lineage.name == context_name:
                    break
                lineage_links.append(
                    "<a href='{}'>{}</a>".format(
                        url_for("context.view_context", context_name=lineage.name),
                        Context.get_display_name(lineage.name),
                    )
                )

    return render_template(
        "contexts/index.html",
        context_name=Context.get_display_name(context_name),
        title=Context.get_display_name(context_name),
        lineage=lineage_links,
        cell_line_table=get_data_table_for_view(
            "context_cell_lines", context=context_name
        ),
        dependency_enrichment_table=get_data_table_for_view(
            "context_dependency_enrichment", context=context_name
        ),
    )
