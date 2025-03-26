import os
import datetime
import urllib.parse
from flask import (
    Blueprint,
    render_template,
    current_app,
    redirect,
    abort,
    jsonify,
    url_for,
    send_from_directory,
    request,
)
from google.oauth2 import service_account

from depmap.extensions import csrf_protect
from sqlalchemy.inspection import inspect
from depmap.global_search.models import GlobalSearchIndex
from depmap.access_control.utils import (
    get_authenticated_user,
    get_current_user_for_access_control,
)
from google.cloud.trace.client import Client

blueprint = Blueprint("dev", __name__, url_prefix="/dev", static_folder="../static")

# useful for debugging access control
@blueprint.route("/whoami")
def whoami():
    return jsonify(
        {
            "authenticated_user": get_authenticated_user(),
            "current_user_for_access_control": get_current_user_for_access_control(),
        }
    )


@blueprint.route("/datasets")
def datasets():
    return render_template("dev/datasets.html")


@blueprint.route("/crawl_start/")
def crawl_start():
    """
    This page is only used by the crawler, as the page to start at. It contains a list of links to initialize the crawl.
    This is done because pages such as gene, cell line, compound, and context pages would usually be accessed via the global search dropdown, which the crawler cannot access by naively getting all <a href=> elements
    """
    global_search_types = inspect(GlobalSearchIndex).columns["type"].type.enums
    global_search_urls = {
        "gene": url_for("gene.view_gene", gene_symbol="SOX10"),
        "gene_alias": url_for("gene.view_gene", gene_symbol="SOX10"),
        "compound": url_for("compound.view_compound", name="AFATINIB"),
        "compound_target_or_mechanism": url_for(
            "compound.view_compound", name="AFATINIB"
        ),
        "compound_target": url_for("compound.view_compound", name="AFATINIB"),
        "compound_alias": url_for("compound.view_compound", name="AFATINIB"),
        "cell_line": url_for("cell_line.view_cell_line", cell_line_name="ACH-000425"),
        "cell_line_alias": url_for(
            "cell_line.view_cell_line", cell_line_name="ACH-000425"
        ),
        "download_file": url_for("download.view_all"),
        "subtype_context": url_for(
            "context_explorer.view_context_explorer", context="BONE"
        ),
    }

    assert all(
        [x in global_search_urls for x in global_search_types]
    ), "Global search type {} is not registered in the the crawl".format(
        set(global_search_types) - set(global_search_urls.keys())
    )

    urls = [url_for("public.home")] + list(set(global_search_urls.values()))

    return render_template("dev/crawl_start.html", urls=urls)


@blueprint.route("/crawl_debug/")
def crawl_debug():
    """
    For dev purposes of debugging the crawl. Add the page to debug.
    A blank page with no nav bar. Loads jquery so that the crawl can get all hrefs
    """
    if current_app.config["ENV"] != "dev":
        abort(404)

    urls = [url_for("public.home")]
    return render_template("dev/crawl_debug.html", urls=urls)


@blueprint.route("/record_spans", methods=["POST"])
@csrf_protect.exempt
def record_spans():
    """
    Recording time spans from frontend as part of distributed tracing. 
    Since the frontend can't send span info to Google Trace, we are forwarding this info.
    ...however... We've disabled this so this is now a no-op
    """
    return jsonify(message="disabled. Nothing stored")


# This was a non-public API added for Ashir to quickly get out coverage about which datasets have which cell lines in the portal
@blueprint.route("/data-coverage")
def get_data_coverage():
    from depmap.dataset.models import (
        DependencyDataset,
        BiomarkerDataset,
        ColMatrixIndex,
    )

    dataset_summary = []

    def mk_summary(dataset):
        depmap_ids = set(
            depmap_id
            for depmap_id, in ColMatrixIndex.query.filter_by(
                matrix_id=dataset.matrix_id
            ).with_entities(ColMatrixIndex.depmap_id)
        )
        summary = {
            "displayName": dataset.display_name,
            "internalName": dataset.name.value,
            "depmapIDs": list(depmap_ids),
        }
        return summary

    for dataset in DependencyDataset.get_all():
        dataset_summary.append(mk_summary(dataset))

    for dataset in BiomarkerDataset.get_all():
        dataset_summary.append(mk_summary(dataset))

    return jsonify(dataset_summary)


@blueprint.route("/table-tester")
def table_tester():
    return render_template("dev/table_tester.html")
