from functools import reduce
import logging
from typing import Tuple

import flask
import pandas as pd
from flask import (
    Blueprint,
    abort,
    jsonify,
    redirect,
    render_template,
    request,
    url_for,
)

from depmap.interactive import interactive_utils
from depmap.celery_task.utils import format_task_status, TaskState
from depmap.correlation.models import CorrelatedDataset
from depmap.correlation.utils import get_all_correlations
from depmap.dataset.models import Dataset
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


## Plot and table ##


def valid_feature(feature, dataset):
    """
    Returns true if feature is in dataset row.
    Deprecated: Not supported for breadbox datasets.
    """
    return interactive_utils.valid_row(dataset, feature)


# Getting plot points


def valid_dataset(thing_to_check, place_to_check):
    """
    Returns true if thing_to_check is a key in the place_to_check config dictionary, false otherwise.
    Deprecated: Not supported for breadbox datasets.
    """
    if place_to_check == "DATASETS":
        return interactive_utils.is_continuous(thing_to_check)
    elif place_to_check == "COLOR_DATASETS":
        return interactive_utils.is_categorical(thing_to_check)
    elif place_to_check == "FILTER_DATASETS":
        return interactive_utils.is_filter(thing_to_check)
    else:
        raise ValueError("Invalid dataset_config_key_name " + place_to_check)


def is_none(value):
    return value == "" or value is None or value == "None" or value == "undefined"


def option_used(optionFeature, optionDataset, dataset_config_key_name=""):
    """
    Deprecated: Not supported for breadbox datasets.
    Returns true if
     1) optionFeature has a non-empty value
     2) The dataset requested is allowed for that particular config (e.g. prevent coloring by a continuous x/y dataset)
     3) The feature is present in the dataset
    Conditions ordered with most potentially expensive one last
    """
    if is_none(optionDataset) or is_none(optionFeature):
        return False

    if dataset_config_key_name != "":
        if not valid_dataset(optionDataset, dataset_config_key_name):
            return False

    if not valid_feature(optionFeature, optionDataset):
        return False

    return True


def merge_x_y(xSeries, ySeries):
    df = pd.merge(
        xSeries.to_frame("x"),
        ySeries.to_frame("y"),
        how="inner",
        left_index=True,
        right_index=True,
    )
    return df


# primary_disease and cell_line_display_name are necessary for data explorer hover info,
# and lineage_display_name is necessary data explorer for CSV Downloads, but these features
# don't have slice Id's that work the same way as other features. This function was added
# to handle that special case independently of InteractiveTree. It's either this, or handle
# the non-slice id features separately from the other features.
def get_dataset_feature_from_id(id: str) -> Tuple[str, str]:
    if id is None or id == "":
        return id, id

    if "primary_disease" in id:
        datasets, feature_labels = "primary_disease", "primary_disease"
    elif "cell_line_display_name" in id:
        datasets, feature_labels = "cell_line_display_name", "cell_line_display_name"
    elif "lineage_display_name" in id:
        datasets, feature_labels = "lineage_display_name", "lineage_display_name"
    else:
        datasets, feature_labels = InteractiveTree.get_dataset_feature_from_id(id)

    return datasets, feature_labels


def get_associations_df(matrix_id, x_feature):
    """Deprecated: Not supported for breadbox datasets."""
    # this works because the dataset display_name is also used at the value in the correlation table
    df = get_all_correlations(matrix_id, x_feature)

    # convert dataset ids to matrix ids to interactive strings
    dataset_id_to_name = {
        dataset.dataset_id: dataset.name.name for dataset in Dataset.get_all()
    }

    if len(df) > 0:
        # this apply returns a series if rows >0, a dataframe otherwise (which cannot be assigned to a single column)
        df["other_slice_id"] = df[["other_dataset_id", "other_entity_label"]].apply(
            lambda x: InteractiveTree.get_id_from_dataset_feature(
                dataset_id_to_name[x[0]], x[1]
            ),
            axis=1,
        )

        df["other_entity_type"] = df[["other_dataset_id"]].apply(
            lambda x: interactive_utils.get_entity_type(dataset_id_to_name[x[0]]),
            axis=1,
        )
    else:
        # so we have to handle the case of an empty data frame
        df["other_slice_id"] = []
        df["other_entity_type"] = []
    df["correlation"] = df["correlation"].apply(lambda x: round(x, 3))

    # drop other_dataset_id
    df = df[
        [
            "other_entity_label",
            "other_dataset",
            "other_slice_id",
            "correlation",
            "other_entity_type",
        ]
    ]

    return df


## Associations ##


@blueprint.route("/api/associations")
def get_associations():
    x_id = request.args.get("x")  # slice ID

    x_dataset_id, x_feature = InteractiveTree.get_dataset_feature_from_id(x_id)
    if x_dataset_id.startswith("breadbox/"):
        # Associations don't exist for breadbox features (yet at least)
        # but we don't want errors when this endpoint is called for a breadbox feature
        return jsonify(
            {
                "data": [],
                "associatedDatasets": [],
                "datasetLabel": "",
                "featureLabel": "",
            }
        )
    # Everything below this point is deprecated: and not supported for breadbox datasets.
    dataset_label = interactive_utils.get_dataset_label(x_dataset_id)
    if not option_used(
        x_feature, x_dataset_id, "DATASETS"
    ) or not interactive_utils.is_standard(
        x_dataset_id
    ):  # fixme test for this path
        return jsonify(
            {
                "data": [],
                "associatedDatasets": [],
                "datasetLabel": dataset_label,
                "featureLabel": x_feature,
            }
        )
    matrix_id = interactive_utils.get_matrix_id(x_dataset_id)

    df = get_associations_df(matrix_id, x_feature)

    display_names = CorrelatedDataset.get_correlated_dataset_display_names(matrix_id)

    response = jsonify(
        {
            "data": df.to_dict(orient="records"),
            "associatedDatasets": display_names,
            "datasetLabel": dataset_label,
            "featureLabel": x_feature,
        }
    )
    return response


@blueprint.route("/api/associations-csv")
def get_associations_csv():
    """Deprecated: Not supported for breadbox datasets."""
    from depmap.partials.views import format_csv_response

    x_id = request.args.get("x")
    x_dataset, x_feature = InteractiveTree.get_dataset_feature_from_id(x_id)

    assert option_used(x_feature, x_dataset, "DATASETS")  # fixme test for this path

    matrix_id = interactive_utils.get_matrix_id(x_dataset)

    df = get_associations_df(matrix_id, x_feature)

    del df["other_slice_id"]
    df.rename(
        columns={
            "other_entity_label": "Gene/Compound",
            "other_dataset": "Dataset",
            "correlation": "Correlation",
        },
        inplace=True,
    )

    return format_csv_response(
        df, "{} in {} associations".format(x_feature, x_dataset), {"index": False}
    )


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
