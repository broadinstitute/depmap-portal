import re
import pandas as pd
from typing import Any, Optional

from breadbox_client.models.compute_response import ComputeResponse
from breadbox_client.models import (
    FeatureResponse,
)
from depmap.data_access.response_parsing import (
    format_breadbox_task_status,
    get_breadbox_slice_id,
    parse_breadbox_slice_id,
    remove_breadbox_prefix,
)
from depmap.interactive.config.categories import CustomCellLinesConfig
from depmap.partials.matrix.models import CellLineSeries
from depmap import extensions
from depmap_compute.slice import SliceQuery

# Since breadbox and the legacy backend contain different datasets, we need to combine
# values from each of their responses before returning a value.
# Over time, more datasets will move to breadbox, and we can get rid of this shim
# as well as the legacy vector catalog endpoints.


def get_feature_data_slice(slice_id: str) -> CellLineSeries:
    parsed_id = parse_breadbox_slice_id(slice_id)
    # Make sure that the requested slice IDs contains a feature ID
    if parsed_id.feature_id is None:
        raise ValueError("Slice ids must include feature ids")
    feature_data = extensions.breadbox.client.get_feature_data(
        dataset_ids=[parsed_id.dataset_id], feature_ids=[parsed_id.feature_id]
    )
    assert len(feature_data) == 1
    feature: FeatureResponse = feature_data[0]
    return CellLineSeries(pd.Series(feature.values.to_dict(), name=feature.label))


def get_features_calculated_value_lists(
    slice_ids: list[str],
) -> tuple[list[CellLineSeries], list[str], list[str], list[str]]:
    """
    Get breadbox feature information in a format that's easily consumable by the legacy codebase.
    Similar to the above get_features method, but less generic.
    I don't generally like the practice of returning multiple values, but that's how 
    the legacy portal tends to organize things, so it's helpful to follow the pattern.
    """
    dataset_ids = [parse_breadbox_slice_id(id).dataset_id for id in slice_ids]
    feature_ids = [parse_breadbox_slice_id(id).feature_id for id in slice_ids]
    breadbox_features: list[
        FeatureResponse
    ] = extensions.breadbox.client.get_feature_data(
        dataset_ids=dataset_ids, feature_ids=feature_ids
    )
    slice_ids = [
        get_breadbox_slice_id(
            dataset_id=feature.dataset_id, feature_id=feature.feature_id
        )
        for feature in breadbox_features
    ]
    feature_values: list[CellLineSeries] = [
        CellLineSeries(pd.Series(feature.values.to_dict(), name=slice_ids[i]))
        for i, feature in enumerate(breadbox_features)
    ]
    axis_labels = [
        f"{feature.label} {feature.units}<br>{feature.dataset_label}"
        for feature in breadbox_features
    ]
    feature_labels = [feature.label for feature in breadbox_features]
    # regenerate the slice ids since the breadbox response might be in a different order than the request
    slice_ids = [
        get_breadbox_slice_id(
            dataset_id=feature.dataset_id, feature_id=feature.feature_id
        )
        for feature in breadbox_features
    ]
    return feature_values, axis_labels, feature_labels, slice_ids


def run_custom_analysis(
    analysis_type: str,
    dataset_slice_id: str,
    slice_query: Optional[SliceQuery],
    vector_variable_type: str,
    query_cell_lines: Optional[list[str]],
    query_values: Optional[list[Any]],
) -> ComputeResponse:
    """
    Run custom analysis in breadbox using a breadbox dataset.
    The selected feature may either be a breadbox feature (specified with the given query_id)
    or a legacy portal feature (specified with the given feature_data).
    Return a task status.
    """
    bb_dataset_id = remove_breadbox_prefix(dataset_slice_id)
    if slice_query:
        # Temporary hack: for now, this slice query ALWAYS specifies a feature by label.
        # This should always be true for our current feature selection component.
        # Soon, this "breadbox_shim" should be removed entirely, along with this hack.
        assert slice_query.identifier_type == "feature_label"

        # Hack part 2: Custom analysis in Breadbox was set up to take a feature's given ID.
        # We have the label here and need to use that to load the given ID.
        query_dataset_id = parse_breadbox_slice_id(slice_query.dataset_id).dataset_id
        all_dataset_features = extensions.breadbox.client.get_dataset_features(
            query_dataset_id
        )
        feature_id = None
        for bb_feature in all_dataset_features:
            if bb_feature["label"] == slice_query.identifier:
                feature_id = bb_feature["id"]
        assert (
            feature_id is not None
        ), f"Unexpected feature label passed to breadbox custom analysis: '{slice_query.identifier}'"

    else:
        feature_id = ""
        query_dataset_id = ""
    bb_task_status = extensions.breadbox.client.compute_univariate_associations(
        analysis_type=analysis_type,
        dataset_id=bb_dataset_id,
        query_feature_id=feature_id,
        query_dataset_id=query_dataset_id,
        vector_variable_type=vector_variable_type,
        query_cell_lines=query_cell_lines,
        query_values=query_values,
    )
    bb_task_status.id = f"breadbox/{bb_task_status.id}"
    return bb_task_status


def get_breadbox_task_status(id: str):
    """
    Get the task status for a given breadbox task id.
    The given id should be formatted like "breadbox/<task-uuid>".
    """
    parsed_id = re.sub("^breadbox/", "", id)
    bb_task_status = extensions.breadbox.client.get_task_status(parsed_id)
    return format_breadbox_task_status(bb_task_status)


def get_category_config(feature_slice_id: str):
    # Hard-coding the category configs used by breadbox for now because
    # it is currently only used for custom analysis two class comparisons
    # (which always used this CustomCellLinesConfig).
    # This will need to be updated once categorical data is more
    # widely supported in breadbox.
    return CustomCellLinesConfig()
