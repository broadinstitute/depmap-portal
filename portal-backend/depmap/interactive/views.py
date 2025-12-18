import logging

import flask
from flask import (
    Blueprint,
    abort,
    jsonify,
    redirect,
    render_template,
    request,
    url_for,
)

from depmap.celery_task.utils import format_task_status, TaskState
from depmap.extensions import csrf_protect
from depmap import data_access
from depmap.user_uploads.tasks import upload_transient_csv
from depmap.user_uploads.utils.task_utils import (
    write_upload_to_local_file,
    write_url_to_local_file,
)
from depmap.vector_catalog.trees import InteractiveTree


log = logging.getLogger(__name__)

blueprint = Blueprint(
    "interactive", __name__, url_prefix="/interactive", static_folder="../static"
)


@blueprint.route("/")
def view_interactive():
    """
    Former Entry point for Data Explorer 1. Now redirects to Data Explorer 2.

    Note that any query paramters will be parsed by the DE2 frontend.
    """
    # args_modified, args_dict = _setup_interactive_args_dict(request)

    return redirect(url_for("data_explorer_2.view_data_explorer_2", **request.args))


@blueprint.route("/custom_analysis")
def view_custom_analysis():
    """
    Entry point for Custom Analysis section
    """
    return render_template("interactive/index.html")


## Cell line url root. This is a weird endpoint, unsure where else to put it ##
@blueprint.route("/api/cellLineUrlRoot")
def get_cell_line_url_root():
    return jsonify(url_for("cell_line.view_cell_line", cell_line_name=""))


@blueprint.route("/api/getCustomAnalysisDatasets")
def get_custom_analysis_datasets():
    """
    Returns matrix datasets (both breadbox and legacy datasets) sorted alphabetically.
    Only matrices with a sample type of "depmap_model" are included.
    Data Explorer 1 and Custom Analysis can't handle other sample types.
    """
    combined_datasets = []
    for dataset in data_access.get_all_matrix_datasets():
        if dataset.is_continuous and dataset.sample_type == "depmap_model":
            combined_datasets.append(dict(label=dataset.label, value=dataset.id,))
    combined_datasets = sorted(
        combined_datasets, key=lambda dataset: dataset.get("label"),
    )
    return jsonify(combined_datasets)


@blueprint.route("/api/dataset/add-csv-one-row", methods=["POST"])
@csrf_protect.exempt
def add_custom_csv_one_row_dataset():
    """
    Add a custom csv in the format
        cell line, value
        cell line, value
        cell line, value
    With no header, and where cell lines are rows
    Saves it as a custom dataset with a fixed row name as follows
    Returns a response that includes the slice id for that one row
    This is a horrible, long, and ugly function. Josephine just got tired to dealing with this
    There is potential for reuse (the try catch stuff, invalid fields) with upload_transient_csv
    """
    datafile = request.files.get("uploadFile")

    row_name = "custom data"

    csv_path = write_upload_to_local_file(datafile)
    result = upload_transient_csv.apply(args=[row_name, "", "row", csv_path, True])

    response = format_task_status(result)
    if response["state"] == TaskState.SUCCESS.value:
        response["sliceId"] = InteractiveTree.get_id_from_dataset_feature(
            response["result"]["datasetId"], row_name
        )

    return jsonify(response)


@blueprint.route("/api/dataset/add-csv", methods=["POST"])
@csrf_protect.exempt
def add_custom_csv_dataset():
    display_name = request.form.get("displayName")
    units = request.form.get("units")
    transposed = request.form.get("transposed").lower() == "true"
    datafile = request.files.get("uploadFile")
    csv_path = write_upload_to_local_file(datafile)
    result = upload_transient_csv.apply(
        args=[display_name, units, transposed, csv_path, False]
    )
    response = format_task_status(result)

    return jsonify(response)


# Do not delete: this is used in the PRISM portal to link to Data Explorer.
# As a result, you won't find any references to this inside the depmap-portal repo, only in the PRISM portal.
@blueprint.route("/from-csv-url")
def download_csv_and_view_interactive():
    """Download a CSV from a link (from a white-listed domain), load the CSV as a
    custom dataset, and redirect to that dataset in Data Explorer."""
    display_name = request.args["display_name"]
    units = request.args["units"]
    file_url = request.args["url"]

    url_upload_whitelist = flask.current_app.config["URL_UPLOAD_WHITELIST"]

    if not any(file_url.startswith(prefix) for prefix in url_upload_whitelist):
        log.warning(
            "Requested download from %s but prefix was not in %s",
            file_url,
            url_upload_whitelist,
        )
        abort(400)

    try:
        csv_path = write_url_to_local_file(file_url)
    except Exception as e:
        log.exception("Got exception in get_data_file_dict_from_url")
        abort(400)

    result = upload_transient_csv.apply(
        args=[display_name, units, True, csv_path, False]
    )

    if result.state == TaskState.SUCCESS.value:
        return redirect(result.result["forwardingUrl"])

    log.error(
        "called upload_transient_csv.apply() but wasn't successful. Result was: %s",
        result,
    )
    abort(500)
