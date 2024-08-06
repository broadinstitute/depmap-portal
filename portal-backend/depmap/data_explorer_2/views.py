import re
import numpy as np
import natsort as ns
import urllib.parse
import scipy.cluster.hierarchy as sch
from flask import (
    Blueprint,
    current_app,
    render_template,
    abort,
    request,
)

from depmap import data_access
from depmap.extensions import csrf_protect
from depmap.access_control import is_current_user_an_admin
from depmap.data_explorer_2.links import get_plot_link, get_tutorial_link
from depmap.data_explorer_2.plot import (
    compute_all,
    compute_dimension,
    compute_filter,
    compute_metadata,
    compute_waterfall,
)
from depmap.data_explorer_2.context import ContextEvaluator
from depmap.data_explorer_2.performance import generate_performance_report
from depmap.data_explorer_2.datasets import (
    get_datasets_matching_context,
    get_datasets_matching_context_with_details,
)
from depmap.data_explorer_2.utils import (
    decode_slice_id,
    get_aliases_matching_labels,
    get_all_supported_continuous_datasets,
    get_entity_labels_across_datasets,
    get_entity_to_datasets_mapping,
    get_file_and_release_from_dataset,
    get_reoriented_df,
    get_series_from_de2_slice_id,
    get_union_of_index_labels,
    get_vector_labels,
    make_gzipped_json_response,
    pluralize,
    to_display_name,
    to_serializable_numpy_number,
)
from depmap.data_explorer_2.linear_regression import compute_linear_regression

from depmap.download.models import ReleaseTerms
from depmap.download.views import get_file_record, get_release_record

blueprint = Blueprint(
    "data_explorer_2",
    __name__,
    url_prefix="/data_explorer_2",
    static_folder="../static",
)


@blueprint.route("/")
def view_data_explorer_2():
    if not current_app.config["ENABLED_FEATURES"].data_explorer_2:
        abort(404)

    return render_template(
        "data_explorer_2/index.html", tutorial_link=get_tutorial_link()
    )


@blueprint.route("/plot_dimensions", methods=["POST"])
@csrf_protect.exempt
def plot_dimensions():
    json = request.get_json()
    index_type = json["index_type"]
    dimensions = json["dimensions"]
    filters = json.get("filters") or {}
    metadata = json.get("metadata") or {}

    return make_gzipped_json_response(
        compute_all(index_type, dimensions, filters, metadata)
    )


@blueprint.route("/get_waterfall", methods=["POST"])
@csrf_protect.exempt
def get_waterfall():
    json = request.get_json()
    index_type = json["index_type"]
    dimensions = json["dimensions"]
    filters = json.get("filters") or {}
    metadata = json.get("metadata") or {}

    return make_gzipped_json_response(
        compute_waterfall(index_type, dimensions, filters, metadata)
    )


@blueprint.route("/linear_regression", methods=["POST"])
@csrf_protect.exempt
def linear_regression():
    json = request.get_json()
    index_type = json["index_type"]
    dimensions = json["dimensions"]
    filters = json.get("filters") or {}
    metadata = json.get("metadata") or {}

    computed = compute_all(index_type, dimensions, filters, metadata)
    linreg_by_group = compute_linear_regression(
        dimensions, computed["dimensions"], computed["filters"], computed["metadata"]
    )

    return make_gzipped_json_response(linreg_by_group)


@blueprint.route("/get_shared_index", methods=["POST"])
@csrf_protect.exempt
def get_shared_index():
    json = request.get_json()
    index_type = json["index_type"]
    dataset_ids = json["dataset_ids"]

    index_labels = get_union_of_index_labels(index_type, dataset_ids)
    index_aliases = get_aliases_matching_labels(index_type, index_labels)

    return make_gzipped_json_response(
        {"index_labels": index_labels, "index_aliases": index_aliases}
    )


@blueprint.route("/get_dimension", methods=["POST"])
@csrf_protect.exempt
def get_dimension():
    json = request.get_json()
    index_type = json["index_type"]
    dimension = json["dimension"]

    output_dimension = compute_dimension(dimension, index_type)

    return make_gzipped_json_response(output_dimension)


@blueprint.route("/get_filter", methods=["POST"])
@csrf_protect.exempt
def get_filter():
    json = request.get_json()
    input_filter = json["filter"]

    output_filter = compute_filter(input_filter)

    return make_gzipped_json_response(output_filter)


@blueprint.route("/get_metadata", methods=["POST"])
@csrf_protect.exempt
def get_metadata():
    json = request.get_json()
    metadata = json["metadata"]

    output_metadata = compute_metadata(metadata)

    return make_gzipped_json_response(output_metadata)


@blueprint.route("/get_correlation", methods=["POST"])
@csrf_protect.exempt
def get_correlation():
    """
    Load the data needed to create a correlation heatmap.
    """
    plot_config = request.get_json()
    index_type = plot_config["index_type"]
    dimension = plot_config["dimensions"]["x"]
    distinguish1 = plot_config.get("filters", {}).get("distinguish1", None)
    distinguish2 = plot_config.get("filters", {}).get("distinguish2", None)
    use_clustering = plot_config.get("use_clustering", False)

    dataset_id = dimension["dataset_id"]
    context = dimension["context"]

    output_index_labels = []
    row_labels = []

    is_transpose = data_access.get_dataset_feature_type(dataset_id) == index_type
    entity_type = (
        data_access.get_dataset_feature_type(dataset_id)
        if not is_transpose
        else data_access.get_dataset_sample_type(dataset_id)
    )
    row_context_evaluator = ContextEvaluator(context)
    dataset_label = data_access.get_dataset_label(dataset_id)

    for label in get_vector_labels(dataset_id, is_transpose):
        if row_context_evaluator.is_match(label):
            row_labels.append(label)

    # bail out if the graph would be too huge to plot
    if len(row_labels) > 100:
        x_dimension = {
            "dataset_id": dataset_id,
            "dataset_label": dataset_label,
            "axis_label": "cannot plot",
            "values": [],
            "context_size": len(row_labels),
        }

        return make_gzipped_json_response(
            {
                "index_type": index_type,
                "index_labels": output_index_labels,
                "dimensions": {"x": x_dimension},
            }
        )

    if len(row_labels) == 0:
        x_dimension = {
            "dataset_id": dataset_id,
            "dataset_label": dataset_label,
            "axis_label": "context produced no matches",
            "values": [],
            "context_size": 0,
        }

        return make_gzipped_json_response(
            {
                "index_type": index_type,
                "index_labels": output_index_labels,
                "dimensions": {"x": x_dimension},
            }
        )

    dimensions = {}
    for dimension_key in ["x", "x2"]:
        col_labels = []

        if dimension_key == "x2" and not distinguish2:
            break

        col_context_evaluator = None

        if dimension_key == "x" and distinguish1:
            col_context_evaluator = ContextEvaluator(distinguish1)

        if dimension_key == "x2" and distinguish2:
            col_context_evaluator = ContextEvaluator(distinguish2)

        for label in get_vector_labels(dataset_id, not is_transpose):
            if not col_context_evaluator or col_context_evaluator.is_match(label):
                col_labels.append(label)

        # Load the dataframe, transposed from how we would normally load it
        df = get_reoriented_df(
            dataset_id=dataset_id,
            row_labels=col_labels,
            col_labels=row_labels,
            is_transpose=(not is_transpose),
        )
        if use_clustering and len(row_labels) > 1 and dimension_key == "x":
            try:
                df = corr_clustered(df)
                row_labels = df.index.to_list()  # type: ignore
            # pylint: disable=broad-exception-caught
            except Exception as e:
                df = df.corr()  # type: ignore

                print("-------------------------------------------------")
                print("Execption while trying to cluster correlation:", e)
                print("Context:", context)
                if distinguish1:
                    print("Distinguished by:", distinguish1)
                print("-------------------------------------------------")
        else:
            df = df.corr()

        if dimension_key == "x2" and use_clustering:
            df = df.reindex(row_labels, axis=0).reindex(row_labels, axis=1)  # type: ignore

        entities = pluralize(to_display_name(entity_type))
        is_anonymous = re.match(r"\(\d+ selected\)", context["name"])
        axis_label = (
            f"correlation of {context['name']} {entities}"
            if is_anonymous
            else f"correlation of {len(row_labels)} {context['name']} {entities}"
        )

        distinguish_count = len(col_labels)
        distinguish_entities = pluralize(to_display_name(index_type))

        if dimension_key == "x" and (distinguish1 or distinguish2):
            axis_label += "<br>distinguished by "
            distinguish_name = distinguish1["name"] if distinguish1 else "All"

            if distinguish_name == "All":
                axis_label += f"all {distinguish_count} "
            else:
                axis_label += f"{distinguish_count} {distinguish_name} "

            axis_label += distinguish_entities

        if dimension_key == "x2" and distinguish2:
            axis_label += "<br>distinguished by "
            axis_label += (
                f"{distinguish_count} {distinguish2['name']} {distinguish_entities}"
            )

        values = df.replace(np.nan, None).values.tolist()  # type: ignore

        dimensions[dimension_key] = {
            "dataset_id": dataset_id,
            "dataset_label": dataset_label,
            "axis_label": axis_label,
            "values": values,
        }

    index_aliases = get_aliases_matching_labels(entity_type, row_labels)

    return make_gzipped_json_response(
        {
            "index_type": index_type,
            "index_labels": row_labels,
            "index_aliases": index_aliases,
            "dimensions": dimensions,
        }
    )


@blueprint.route("/datasets_by_index_type")
def datasets_by_index_type():
    output = {}

    def append_by_index_type(dataset):
        if not dataset["index_type"] in output:
            output[dataset["index_type"]] = []
        output[dataset["index_type"]].append(dataset)

    for dataset in get_all_supported_continuous_datasets():
        common_props = {
            "data_type": dataset.data_type,
            "dataset_id": dataset.id,
            "label": dataset.label,
            "units": dataset.units,
            "priority": dataset.priority,
        }

        append_by_index_type(
            dict(
                common_props,
                index_type=dataset.sample_type,
                entity_type=dataset.feature_type,
            )
        )

        append_by_index_type(
            dict(
                common_props,
                index_type=dataset.feature_type,
                entity_type=dataset.sample_type,
            )
        )

    for index_type, dataset in output.items():
        output[index_type] = sorted(dataset, key=lambda dataset: dataset["label"],)

    return make_gzipped_json_response(output)


@blueprint.route("/entity_labels")
def entity_labels():
    entity_type = request.args.get("entity_type")
    labels = get_entity_labels_across_datasets(entity_type)
    aliases = get_aliases_matching_labels(entity_type, labels)

    return make_gzipped_json_response({"labels": labels, "aliases": aliases})


@blueprint.route("/entity_to_datasets_mapping")
def entity_to_datasets_mapping():
    entity_type = request.args.get("entity_type")

    mapping = get_entity_to_datasets_mapping(entity_type)
    mapping["aliases"] = get_aliases_matching_labels(
        entity_type, mapping["entity_labels"].keys()
    )

    return make_gzipped_json_response(mapping)


@blueprint.route("/entity_labels_of_dataset")
def entity_labels_of_dataset():
    entity_type = request.args.get("entity_type")
    dataset_id = urllib.parse.unquote(request.args.get("dataset_id"))

    is_transpose = entity_type == data_access.get_dataset_sample_type(dataset_id)

    labels = get_vector_labels(dataset_id, is_transpose)
    aliases = get_aliases_matching_labels(entity_type, labels)

    return make_gzipped_json_response({"labels": labels, "aliases": aliases})


@blueprint.route("/unique_values_or_range")
def unique_values_or_range():
    slice_id = request.args.get("slice_id")
    dataset_id, _, _ = decode_slice_id(slice_id)
    series = get_series_from_de2_slice_id(slice_id)

    if data_access.is_continuous(dataset_id):
        return make_gzipped_json_response(
            {
                "value_type": "continuous",
                "min": to_serializable_numpy_number(series.min()),
                "max": to_serializable_numpy_number(series.max()),
            }
        )

    if series.size == 0:
        return make_gzipped_json_response(
            {"value_type": "categorical", "unique_values": []}
        )

    unique_values = []

    # HACK: Infer if the values are lists by looking at the first member of the
    # series. If so, we assume it's a list of strings. When we rework this to
    # use BreadBox, we can take advantage of its "list_strings" AnnotationType.
    # https://github.com/broadinstitute/depmap-portal/blob/a2e2cc9/breadbox-client/breadbox_client/models/annotation_type.py#L8
    if isinstance(series[0], list):
        all_values = series.explode()
        if dataset_id == "mutation_protein_change_by_gene":
            unique_values = all_values.value_counts().index.tolist()
        else:
            set_of_unique_values = set(all_values)
            unique_values = ns.natsorted(list(set_of_unique_values), alg=ns.IGNORECASE)

        return make_gzipped_json_response(
            {"value_type": "list_strings", "unique_values": unique_values}
        )

    df = series.value_counts()
    df = df.reindex(index=ns.natsorted(df.index, alg=ns.IGNORECASE))
    unique_values = df.index.tolist()

    return make_gzipped_json_response(
        {"value_type": "categorical", "unique_values": unique_values}
    )


@blueprint.route("/context/labels", methods=["POST"])
@csrf_protect.exempt
def get_labels_matching_context():
    """
    Get the full list of labels (in any dataset) which match the given context.
    Also include the count of "candidate" labels, which belong to the given 
    dimension type (called "context_type" here).
    """
    # TODO: remove aliases
    inputs = request.get_json()
    context = inputs["context"]
    context_type = context["context_type"]
    # Performance: combines labels from all datasets, then iterates through
    context_evaluator = ContextEvaluator(context)
    input_labels = get_entity_labels_across_datasets(context_type)

    labels_matching_context = []

    for label in input_labels:
        if context_evaluator.is_match(label):
            labels_matching_context.append(label)

    aliases = get_aliases_matching_labels(context_type, labels_matching_context)

    response = {
        "labels": labels_matching_context,
        "num_candidates": len(input_labels),
        "num_matches": len(labels_matching_context),
    }

    return make_gzipped_json_response(response)


@blueprint.route("/context/datasets", methods=["POST"])
@csrf_protect.exempt
def get_datasets_matching_context():
    """
    Get the list of datasets which have data matching the given context.
    For each dataset, include the full list of entity labels matching the context.
    """
    # Performance: iterates through each label in each dataset
    inputs = request.get_json()
    context = inputs["context"]
    out = get_datasets_matching_context_with_details(context)

    return make_gzipped_json_response(out)


@blueprint.route("/dataset_details")
def dataset_details():
    dataset_id = urllib.parse.unquote(request.args.get("dataset_id"))

    dataset = data_access.get_matrix_dataset(dataset_id)
    file, release = get_file_and_release_from_dataset(dataset)

    if file is None:
        return make_gzipped_json_response({})

    return make_gzipped_json_response(
        {
            "file": get_file_record(release, file),
            "release": get_release_record(release, True),
            "termsDefinitions": ReleaseTerms.get_terms_to_text(),
        }
    )


@blueprint.route("/dataset_descriptions")
def dataset_descriptions():
    out = []

    for dataset in data_access.get_all_matrix_datasets():
        file, release = get_file_and_release_from_dataset(dataset)

        if file is None:
            out.append(
                {"dataset_id": dataset.id, "label": dataset.label,}
            )
        else:
            out.append(
                {
                    "dataset_id": dataset.id,
                    "label": dataset.label,
                    "file": get_file_record(release, file),
                }
            )

    return make_gzipped_json_response(out)


@blueprint.route("/url_from_slice_ids")
def url_from_slice_ids():
    x = request.args.get("x")
    y = request.args.get("y")
    color = request.args.get("color")
    filter_arg = request.args.get("filter")
    regression_line = request.args.get("regressionLine")

    return get_plot_link(x, y, color, filter_arg, regression_line)


@blueprint.route("/performance")
def performance():
    if not current_app.config["DEBUG"] and not is_current_user_an_admin():
        return abort(404)

    return make_gzipped_json_response(generate_performance_report())


def corr_clustered(df):
    if df.empty:
        return [], df

    corr_array = df.corr()
    pairwise_distances = sch.distance.pdist(corr_array)
    linkage = sch.linkage(pairwise_distances, method="complete")
    cluster_distance_threshold = pairwise_distances.max() / 2
    idx_to_cluster_array = sch.fcluster(
        linkage, cluster_distance_threshold, criterion="distance"
    )
    idx = np.argsort(idx_to_cluster_array)
    return corr_array.iloc[idx, :].T.iloc[idx, :]
