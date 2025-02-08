from io import StringIO
from json import loads as json_loads
from json import dumps as json_dumps

import flask
from flask import Blueprint, Response, request

from depmap import data_access
from depmap.dataset.models import BiomarkerDataset
from depmap.entity.models import Entity
from depmap.extensions import cache_without_user_permissions
from depmap.partials.data_table.factories import get_data_table
from depmap.partials.entity_summary.models import (
    format_strip_plot,
    get_download_data,
    get_feature_data, 
    get_entity_summary_metadata,
    integrate_cell_line_information,
    integrate_size_and_label_data,
    integrate_color_data,
)
from depmap.utilities.filename_utils import sanitize_filename_string


blueprint = Blueprint(
    "partials", __name__, url_prefix="/partials", static_folder="../static"
)


@blueprint.route("/data_table/<type>")
@cache_without_user_permissions()
def data_table_json_data(type):
    """
    Endpoint for all data_tables
    """
    return format_json_response(get_data_table, type)


@blueprint.route("/data_table/download/<type>")
@cache_without_user_permissions()
def data_table_download(type):
    """
    Endpoint to download data_tables
    """
    data_table = _parse_args_and_call_func(get_data_table, type)
    if isinstance(data_table.filename, str):
        filename = data_table.filename
    else:
        function = data_table.filename["function"]
        params = data_table.filename["params"]
        filename = function(**params)
    return format_csv_response(data_table._df, filename, {"index": False})


@blueprint.route("/data_table/download_temp/<type>")
@cache_without_user_permissions()
def data_table_download_temp(type):
    """
    Endpoint to download data_tables
    """
    data_table = _parse_args_and_call_func(get_data_table, type)
    df = data_table._df

    temp_df = df.drop(
        columns=[col for col in ["Oncogenic", "Mutation Effect"] if col in df]
    )

    if isinstance(data_table.filename, str):
        filename = data_table.filename
    else:
        function = data_table.filename["function"]
        params = data_table.filename["params"]
        filename = function(**params)
    return format_csv_response(temp_df, filename, {"index": False})


@blueprint.route("/entity_summary")
@cache_without_user_permissions()
def entity_summary_json_data():
    """
    Not using _parse_args_and_call_func just because we need to get entity label, and process the size biom enum 
    """
    # Note: this entity ID param is NOT what breadbox uses as feature IDs. 
    entity_id = request.args.get("entity_id")
    entity = Entity.query.get(entity_id) # Compound, Gene
    dataset_id = request.args.get("dep_enum_name") # Dataset ID
    size_dataset_id = request.args.get("size_biom_enum_name") # Another dataset ID, Ex. 'expression' - expected to NOT be a breadbox dataset
    color = request.args.get("color") # Ex. 'mutations_prioritized'

    if size_dataset_id == "none":
        size_dataset_enum = None
    else:
        size_dataset_enum = BiomarkerDataset.BiomarkerEnum(size_dataset_id)

    if color == "none":
        color = None

    feature_data = get_feature_data(dataset_id, entity.label)
    metadata = get_entity_summary_metadata(dataset_id, feature_data, entity.label)

    df = integrate_cell_line_information(feature_data)
    df, legend = integrate_size_and_label_data( # TODO: size biom enum is a dataset ID???
        df, metadata["x_label"], size_dataset_enum, entity_id
    )
    df, legend = integrate_color_data(df, legend, color, entity.label)

    response = {
        "legend": legend,
        "x_range": metadata["x_range"],
        "x_label": metadata["x_label"],
        "description": metadata["description"],
        "interactive_url": metadata["interactive_url"],
        "entity_type": entity.type,
    }
    if "line" in metadata:
        response["line"] = metadata["line"]

    # histogram just uses the data from the strip plot
    response["strip"] = format_strip_plot(df)

    return Response(json_dumps(response), mimetype="application/json")

@blueprint.route("/entity_summary/download")
def entity_summary_download():
    """
    Endpoint to download entity summary data 
    """
    entity_id = request.args.get("entity_id")
    dataset_id = request.args.get("dep_enum_name")
    size_dataset_id = request.args.get("size_biom_enum_name")
    color = request.args.get("color")

    entity = Entity.query.get(entity_id)
    if size_dataset_id == "none":
        size_dataset_enum = None
    else:
        size_dataset_enum = BiomarkerDataset.BiomarkerEnum(size_dataset_id)

    if color == "none":
        color = None

    df = get_download_data(
        dataset_id=dataset_id,
        entity=entity,
        size_dataset_enum=size_dataset_enum,
        color_dataset_id=color,
    )
    dataset = data_access.get_matrix_dataset(dataset_id)
    filename = "{} {}".format(entity.label, dataset.label)
    return format_csv_response(df, filename)


def _parse_args_and_call_func(func_to_call, type):
    """
    Fixme naming 
    """
    if request.method == "POST":
        kwargs = json_loads(request.form.get("data"))
    elif (
        request.method == "GET" or request.method == "HEAD"
    ):  # head is used for the crawler
        kwargs = {k: request.args[k] for k in request.args}
    else:
        raise NotImplementedError

    return func_to_call(type, **kwargs)


def format_json_response(func_to_call, type):
    response = Response(
        _parse_args_and_call_func(func_to_call, type).json_data(),
        mimetype="application/json",
    )
    return response


def format_csv_response(object_with_to_csv, csv_name, to_csv_kwargs=None):
    to_csv_kwargs = {} if to_csv_kwargs is None else to_csv_kwargs
    string_buffer = StringIO()
    object_with_to_csv.to_csv(string_buffer, **to_csv_kwargs)
    sanitized_csv_name = sanitize_filename_string(csv_name)

    response = flask.make_response(string_buffer.getvalue())
    response.headers["Content-Disposition"] = "attachment; filename={}.csv;".format(
        sanitized_csv_name
    )
    response.headers["Content-Type"] = "text/csv"
    return response
