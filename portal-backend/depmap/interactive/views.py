from functools import reduce
import logging
from decimal import Decimal
from enum import Enum
from math import isnan
from typing import List, Tuple

import flask
import pandas as pd
from flask import (
    Blueprint,
    abort,
    current_app,
    jsonify,
    redirect,
    render_template,
    request,
    url_for,
)
from scipy.stats import linregress, pearsonr, spearmanr

from depmap.interactive import interactive_utils
from depmap.breadbox_shim import breadbox_shim
from depmap.celery_task.utils import format_task_status, TaskState
from depmap.cell_line.models import CellLine
from depmap.correlation.models import CorrelatedDataset
from depmap.correlation.utils import get_all_correlations
from depmap.dataset.models import Dataset, Mutation
from depmap.enums import BiomarkerEnum
from depmap.extensions import csrf_protect
from depmap.interactive import common_utils
from depmap import data_access
from depmap.interactive.config.categories import CategoryConfig
from depmap.interactive.models import FeatureGroup, LinRegInfo, PlotFeatures
from depmap.user_uploads.tasks import upload_transient_csv, upload_transient_taiga
from depmap.user_uploads.utils.task_utils import (
    write_upload_to_local_file,
    write_url_to_local_file,
)
from depmap.utilities.mobile_utils import is_mobile
from depmap.vector_catalog.trees import InteractiveTree
from depmap.utilities.data_access_log import log_feature_access


log = logging.getLogger(__name__)

blueprint = Blueprint(
    "interactive", __name__, url_prefix="/interactive", static_folder="../static"
)


class CellLineInfoFeatures(Enum):
    # These features don't have a corresponding slice id but
    # are always needed for Data Explorer tooltips and CSV downloads.
    primary_disease = "primary_disease"
    cell_line_display_name = "cell_line_display_name"
    lineage_display_name = "lineage_display_name"


def _setup_interactive_args_dict(request) -> Tuple[bool, dict]:
    # request.args is an ImmutableMultiDict
    # below warns that conversion to a dict must be done with .to_dict()
    # https://werkzeug.palletsprojects.com/en/0.14.x/datastructures/#werkzeug.datastructures.OrderedMultiDict
    # ^ applies to OrderedMultiDict but would also seem to apply to ImmutableMultiDict
    args_dict = request.args.to_dict()

    args_modified = False
    if is_mobile(request) and request.args.get("associationTable") == "true":
        args_dict["associationTable"] = "false"
        args_modified = True

    for section in ["x", "y", "color", "filter"]:

        dataset = "{}Dataset".format(section)
        feature = "{}Feature".format(section)
        if (
            dataset in args_dict
            and feature in args_dict
            and args_dict[dataset]
            and args_dict[feature]
        ):  # blank strings are falsy
            # we have previously hit some bugs over these being lists vs stirngs, so just making sure
            assert type(args_dict[dataset]) == str and type(args_dict[feature]) == str
            args_dict[section] = InteractiveTree.get_id_from_dataset_feature(
                args_dict[dataset], args_dict[feature]
            )
            del args_dict[dataset]
            del args_dict[feature]
            args_modified = True

    return args_modified, args_dict


@blueprint.route("/")
def view_interactive():
    """
    Entry point for interactive section
    """
    args_modified, args_dict = _setup_interactive_args_dict(request)

    if args_modified:
        return redirect(url_for("interactive.view_interactive", **args_dict))
    else:
        return render_template("interactive/index.html")


@blueprint.route("/custom_analysis")
def view_custom_analysis():
    """
    Entry point for Custom Analysis section
    """
    return render_template("interactive/index.html")


@blueprint.route("/v2")
def view_interactive_v2():
    """
    Entry point for interactive section
    """
    args_modified, args_dict = _setup_interactive_args_dict(request)

    if args_modified:
        return redirect(url_for("interactive.view_interactive_v2", **args_dict))
    else:
        return render_template("interactive/index_v2.html")


## Cell line url root. This is a weird endpoint, unsure where else to put it ##


@blueprint.route("/api/cellLineUrlRoot")
def get_cell_line_url_root():
    return jsonify(url_for("cell_line.view_cell_line", cell_line_name=""))


@blueprint.route("/api/getDatasets")
def get_datasets():
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


# We don't know how many features will be fed into get-features at one time, so we use this to handle merging an unknown amount
def merge_multi_row_vals(series_list: List[pd.Series]) -> pd.DataFrame:
    df_list = [series.to_frame() for series in series_list]
    df = reduce(
        lambda x, y: pd.merge(
            x,
            y,
            how="inner",
            left_index=True,
            right_index=True,
            suffixes=(None, "_right"),
        ),
        df_list,
    )

    return df


def merge_x_y(xSeries, ySeries):
    df = pd.merge(
        xSeries.to_frame("x"),
        ySeries.to_frame("y"),
        how="inner",
        left_index=True,
        right_index=True,
    )
    return df


def filter_df(df, filter_dataset, filter_feature):
    """Deprecated: Not supported for breadbox datasets."""
    # filter is a binary thing. it is currently only implemented for context
    assert filter_dataset in {
        interactive_utils.get_context_dataset(),
        interactive_utils.get_custom_cell_lines_dataset(),
    }

    # for both context and custom cellines, get row of values returns a series where all values are the filter_feature, e.g. skin
    # nas are dropped, so it only returns cell lines for which the value is "true"
    # thus, we can do the filtering by doing an inner join
    feature_series = interactive_utils.get_row_of_values(filter_dataset, filter_feature)
    assert feature_series.isnull().sum() == 0

    filter_df = pd.merge(
        df,
        feature_series.to_frame("filter"),
        how="inner",  # this does the filtering
        left_index=True,
        right_index=True,
    )

    return filter_df


def make_one_redundant_group(df):
    """
    Put the entire df in one group, so we have the same data structure for future functions to manipulate
    """
    df["color"] = 0
    grouped = df.groupby("color")
    return grouped


def group_df(
    df: pd.DataFrame, feature_series: pd.Series, category_config: CategoryConfig
):
    """
    Returns a grouped dataframe. The name of each group is the color value of that group.
    
    The groupby works because the color values are discrete. But if its accidentally called on continuous values, the groupby will die
    By this point, color_dataset and color_feature have been validated as legit values by option_used
    If we want traces to show up even if no points, use pandas categories (http://pandas.pydata.org/pandas-docs/stable/categorical.html#operations)

    Everything here must stay as value. It cannot be converted to label or display name
    This is because the consumers of this function want to use the value to construct categories to figure out the color (hex or number)
    """
    color_df = pd.merge(
        df,
        feature_series.to_frame("color"),
        how="left",
        left_index=True,
        right_index=True,
    )
    color_df["color"].fillna(category_config.get_na_category().value, inplace=True)
    grouped = color_df.groupby("color")

    return grouped


def regress_two_vars(x, y):
    """
    At least three points before we draw a line
    Returns none for all three attributes if there are less than three points
    """
    if len(x) < 3:
        return {
            "linear_regression": None,
            "pearson": None,
            "spearman": None,
            "length": len(x),
        }
    linear_regression = linregress(x, y)
    pearson = pearsonr(x, y)
    spearman = spearmanr(x, y)

    return {
        "linear_regression": linear_regression,
        "pearson": pearson,
        "spearman": spearman,
        "length": len(x),
    }


def attribute_exists(series, index, attribute_of_series):
    if index in series:
        if attribute_of_series in series[index]:
            if series[index][attribute_of_series] is not None:
                return True
    return False


def sci_notation_if_not_nan(number):
    if not isnan(number):
        return "{0:.2E}".format(Decimal(number))
    return ""


def three_dp_if_not_nan(number):
    if not isnan(number):
        return "{0:.3f}".format(number)
    return ""


def format_regression_info_table(
    regression_info, all_groups, must_have_group_column=False
):
    """
    Pass this through a dict/object phase so less likely to make mistakes in indexing
    """
    headers = [
        "Number of Points",
        "Pearson",
        "Spearman",
        "Slope",
        "Intercept",
        "p-value (linregress)",
    ]
    if len(all_groups) > 1 or must_have_group_column:
        headers.insert(0, "Group")

    table = [headers]

    for name in all_groups:
        if attribute_exists(regression_info, name, "linear_regression"):
            slope, intercept, r_value, p_value, std_err = regression_info[name][
                "linear_regression"
            ]
        else:
            slope, intercept, r_value, p_value, std_err = None, None, None, None, None
            """
            Variables reused in python loops
            I don't wanna check 4 times if linear_regression exists, but I also want to be able to unpack slope, intercept etc. into variables so we're not just pointing at indices
            """

        row_dict = {
            "Group": name,
            "Pearson": three_dp_if_not_nan(regression_info[name]["pearson"][0])
            if attribute_exists(regression_info, name, "pearson")
            else "",
            "Spearman": three_dp_if_not_nan(regression_info[name]["spearman"][0])
            if attribute_exists(regression_info, name, "spearman")
            else "",
            "Slope": sci_notation_if_not_nan(slope) if slope is not None else "",
            "Intercept": sci_notation_if_not_nan(intercept)
            if intercept is not None
            else "",
            "p-value (linregress)": sci_notation_if_not_nan(p_value)
            if p_value is not None
            else "",
            "Number of Points": regression_info[name]["length"]
            if name in regression_info.index
            else 0,
        }

        row_list = [row_dict[col] for col in headers]
        # table.append(row_list)
        """
        insert 1 so insert after header
        reverse order so appear same order as plot legend
        there shouldnt be more than 4 groups
        """
        table.insert(1, row_list)

    return table


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


# This was added to support passing multiple features as "get-features" parameters
def get_df_from_feature_list(
    datasets: list[str],
    feature_labels: list[str],
    feature_ids: list[str],
    cell_line_info_features: list[str],
    breadbox_feature_data: list[pd.Series] = [],
):
    # Load legacy feature data into a dataframe
    values = []
    seen_features_ids = []
    for i, feature_label in enumerate(feature_labels):
        if feature_label not in cell_line_info_features:
            # There is a rare case where the same feature might be selected twice (e.g. for both x and y dropdowns in
            # data explorer). So if we've already pulled the row values, skip pulling them a 2nd time
            if feature_ids[i] in seen_features_ids:
                continue

            # record to the log that a user fetched this column
            log_feature_access("get_df_from_feature_list", datasets[i], feature_label)

            # Get a Series with name being the feature slice id
            val = interactive_utils.get_row_of_values(
                datasets[i], feature_label
            ).rename(feature_ids[i], inplace=True)

            values.append(val)
            seen_features_ids.append(feature_ids[i])
    values.extend(breadbox_feature_data)
    df = merge_multi_row_vals(values)
    df.dropna(
        inplace=True
    )  # Cannot be plotted if na, even if the other x or y has a value
    df["depmap_id"] = df.index
    return df


def add_cell_line_features_to_df(df: pd.DataFrame):
    # These features don't have a corresponding slice id but
    # are always needed for Data Explorer tooltips and CSV downloads.
    if "primary_disease" in df.columns:
        del df["primary_disease"]
    info_to_merge = CellLine.get_cell_line_information_df(df.index)
    del info_to_merge[
        "lineage_level"
    ]  # probably not necesary to delete, but just a precaution to preserve existing behavior

    df = pd.merge(df, info_to_merge, left_index=True, right_index=True)
    return df


def add_mutation_labels(df, mutated_gene, append_mutated_gene=True):
    """
    Appends mutation info as labels to the df 
    """
    labels_series = Mutation.get_mutation_detail_label(mutated_gene)
    if append_mutated_gene:
        labels_series = labels_series.apply(
            lambda label: mutated_gene + " mutations:|" + label
        )
    labeled_df = pd.merge(
        df,
        labels_series.to_frame("label"),
        how="left",
        left_index=True,
        right_index=True,
    )
    return labeled_df


@blueprint.route("/api/get-features")
def get_features():
    """
    Returns ingredients necessary for typescript to derive json object of x and y coordinates to plot. feature_ids are values of cells from the specified database and row
    """
    feature_ids = request.args.getlist("features")
    group_by_id = request.args.get("groupBy")
    filter_id = request.args.get("filter")
    compute_linear_fit = request.args.get(
        "computeLinearFit", default=False, type=lambda v: v.lower() == "true"
    )

    breadbox_slice_ids = [id for id in feature_ids if id.startswith("breadbox/")]
    legacy_feature_ids = [id for id in feature_ids if not id.startswith("breadbox/")]
    if breadbox_slice_ids:
        (
            breadbox_feature_values,
            breadbox_axis_labels,
            breadbox_feature_labels,
            breadbox_slice_ids,
        ) = breadbox_shim.get_features_calculated_value_lists(
            slice_ids=breadbox_slice_ids
        )

    else:
        breadbox_feature_values = []
        breadbox_axis_labels = []
        breadbox_feature_labels = []

    # Load legacy metadata
    legacy_datasets, legacy_feature_labels = [], []
    if len(legacy_feature_ids) > 0:
        # Usually, datasets,feature_labels will look similar to this: 'RNAi_merged', 'SOX10'.
        # Meta data, such as "primary_disease" and "cell_line_display_name" will look like this: '', 'primary_disease'
        legacy_datasets, legacy_feature_labels = zip(
            *[get_dataset_feature_from_id(id) for id in legacy_feature_ids]
        )
    if len(legacy_feature_labels) < 1 and len(breadbox_slice_ids) < 1:
        return jsonify(PlotFeatures([], [], [], "", []))

    cell_line_info_features = [e.value for e in CellLineInfoFeatures]

    # Load legacy feature values and merge the feature data
    # so that x_feature, y_feature, primary_diseases, etc.
    # are all lined up in order by depmap_id.
    df = get_df_from_feature_list(
        list(legacy_datasets),
        list(legacy_feature_labels),
        legacy_feature_ids,
        cell_line_info_features,
        breadbox_feature_values,
    )

    # Filter the dataframe
    if filter_id and filter_id.startswith("breadbox/"):
        filter_series = breadbox_shim.get_feature_data_slice(filter_id)
        df = df.merge(filter_series, left_index=True, right_index=True)
    else:
        filter_dataset, filter_feature = get_dataset_feature_from_id(filter_id)
        if option_used(filter_feature, filter_dataset, "FILTER_DATASETS"):
            df = filter_df(df, filter_dataset, filter_feature)

    # Add cell line metadata to result
    if any(f in cell_line_info_features for f in list(legacy_feature_labels)):
        df = add_cell_line_features_to_df(df)

    # Read dataset units and labels from config, format into axis labels
    legacy_axis_labels = []
    for i in range(len(legacy_feature_ids)):
        if legacy_feature_labels[i] in cell_line_info_features:
            legacy_axis_labels.append("")
        else:
            legacy_axis_labels.append(
                common_utils.format_axis_label(
                    legacy_datasets[i], legacy_feature_labels[i]
                )
            )

    # construct feature objects
    features = common_utils.get_features_from_ungrouped_df(
        df=df,
        feature_labels=list(legacy_feature_labels) + breadbox_feature_labels,
        axis_labels=legacy_axis_labels + breadbox_axis_labels,
        feature_ids=legacy_feature_ids + breadbox_slice_ids,
    )
    depmap_ids = list(df["depmap_id"])

    # Since breadbox features were filtered out and loaded separately, the results may now be out of order.
    # Re-order the resulting features to match the order in the request.
    features_by_feature_id = {f.feature_id: f for f in features}
    ordered_features = [
        features_by_feature_id[requested_feature_id]
        for requested_feature_id in feature_ids
    ]

    group_by = ""
    group_by_dataset = ""
    if group_by_id and group_by_id.startswith("breadbox/"):
        # Load the group_by feature and configs from breadbox
        group_by_category_config = breadbox_shim.get_category_config(group_by_id)
        group_by_series = breadbox_shim.get_feature_data_slice(group_by_id)
        df = group_df(df, group_by_series, group_by_category_config)
        group_by = group_by_series.name  # feature label
        group_by_feature = group_by_series.name
    elif group_by_id:
        (
            group_by_dataset,
            group_by_feature,
        ) = InteractiveTree.get_dataset_feature_from_id(group_by_id)

        if group_by_dataset == BiomarkerEnum.mutations_prioritized.name:
            df = add_mutation_labels(df, group_by_feature)

        group_by_category_config = interactive_utils.get_category_config(
            group_by_dataset
        )
        group_by_series = interactive_utils.get_row_of_values(
            group_by_dataset, group_by_feature
        )
        df = group_df(df, group_by_series, group_by_category_config)
        group_by = group_by_dataset
    else:
        df = make_one_redundant_group(df)

    all_groups = df.groups.keys()

    lin_reg_info: List[LinRegInfo] = []

    if compute_linear_fit and len(feature_ids) > 1:
        x_key = feature_ids[0]
        y_key = feature_ids[1]
        regression_info = df.apply(
            lambda group: regress_two_vars(group[x_key], group[y_key])
        )
        # all_groups is needed because the regression might not return values for some groups
        # we still want to indicate that those groups exist, just that they didn't have regression info
        table = format_regression_info_table(regression_info, all_groups)
        lin_reg_info = common_utils.get_lin_reg_info_list(table)
    else:
        regression_info = None
        table = [[]]

    groups: List[FeatureGroup] = []
    for group_name, group in df:
        # Get color category so that custom analysis can properly name in group and out group for 2-class comparison
        group_label = group_name

        color = list(group["color"])
        if group_by_id:
            category = group_by_category_config.get_category(
                group_name, group_by_feature
            )
            group_label = category.legend_label
            color = category.color

        color_num = color if "color" in group else 0
        groups.append(FeatureGroup(group_label, list(group["depmap_id"]), color_num))

    plot_features = PlotFeatures(
        lin_reg_info, depmap_ids, ordered_features, group_by, groups
    )

    return jsonify(plot_features)


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
    x_id = request.args.get("x")
    if x_id.startswith("breadbox/"):
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
    x_dataset, x_feature = InteractiveTree.get_dataset_feature_from_id(x_id)
    dataset_label = interactive_utils.get_dataset_label(x_dataset)
    if not option_used(
        x_feature, x_dataset, "DATASETS"
    ) or not interactive_utils.is_standard(
        x_dataset
    ):  # fixme test for this path
        return jsonify(
            {
                "data": [],
                "associatedDatasets": [],
                "datasetLabel": dataset_label,
                "featureLabel": x_feature,
            }
        )
    matrix_id = interactive_utils.get_matrix_id(x_dataset)

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


## Custom datasets. Supporting functions in nonstandard/custom_dataset.py ##
@blueprint.route("/api/dataset/add-taiga", methods=["POST"])
@csrf_protect.exempt
def add_custom_taiga_dataset():
    """
    Endpoint to add custom taiga dataset
    Returns ok with an identifier, or not ok with what is wrong
    Assuming people don't whack this endpoint with invalid inputs (ie bypass front end checks), the only thing that could go wrong is that the taiga id does not exist
    """
    if not current_app.config["ENABLED_FEATURES"].use_taiga_urls:
        abort(
            404
        )  # 404 seems more appropriate than 403 since the entire server will not fulfil this request, regardless of permissions

    metadata = request.get_json()
    result = upload_transient_taiga.apply(
        args=[
            metadata["displayName"],
            metadata["units"],
            metadata["transposed"],
            metadata["taigaId"],
        ]
    )
    response = format_task_status(result)

    return jsonify(response)


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
    use_data_explorer_2 = (
        request.form.get("useDataExplorer2", "false").lower() == "true"
    )
    datafile = request.files.get("uploadFile")
    csv_path = write_upload_to_local_file(datafile)
    result = upload_transient_csv.apply(
        args=[display_name, units, transposed, csv_path, False, use_data_explorer_2]
    )
    response = format_task_status(result)

    return jsonify(response)


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
