import re
import pandas as pd
from typing import Any, Optional, Union

from breadbox_client.models.compute_response import ComputeResponse
from breadbox_client.models import (
    MatrixDatasetResponse,
    TabularDatasetResponse,
    FeatureResponse,
    ValueType,
)
from depmap import data_access
from depmap.data_access.response_parsing import (
    format_breadbox_task_status,
    get_breadbox_slice_id,
    parse_breadbox_slice_id,
)
from depmap.interactive.config.categories import CustomCellLinesConfig
from depmap.vector_catalog.models import Node, NodeType
from depmap.vector_catalog.trees import Trees
from depmap.partials.matrix.models import CellLineSeries
from depmap import extensions
from depmap_compute.slice import SliceQuery

# Since breadbox and the legacy backend contain different datasets, we need to combine
# values from each of their responses before returning a value.
# Over time, more datasets will move to breadbox, and we can get rid of this shim
# as well as the legacy vector catalog endpoints.


class BreadboxVectorCatalogChildNode(Node):
    """
    Similar to Vector Catalog's Node object, but with many fewer parameters and assertions.
    vector_catalog.models.Node has many required fields which don't make sense (and aren't useful)
    for breadbox nodes, so a simpler version is being used as a return type in the shim.
    """

    def __init__(
        self,
        slice_id: str,
        label: str,
        value: str,  # For datasets, this should be the ID, for features, it's the label
        is_terminal: bool,
    ):
        # Fill in defaults for values that are required in the Node type
        super().__init__(
            id=slice_id,
            key=None,
            attrs={},
            is_terminal=is_terminal,
            label=label,
            value=value,  # maps onto childValue in the API response
            children_list_type=NodeType.dynamic if not is_terminal else None,
            children_category="generic entity" if not is_terminal else None,
        )


class BreadboxVectorCatalogNodeInfo:
    """ 
    Vector Catalog endpoints return a specific dictionary structure for each parent node 
    in the vector catalog tree. This class reflects that same structure and contains
    some defaults specific to breadbox.
    """

    def __init__(
        self,
        children: list[Node],  # list of BreadboxVectorCatalogChildNode or Node
        slice_id: str = None,
    ):
        self.children = children
        self.children_category = "generic entity"
        self.persist_child_if_not_found = False
        self.selected_id = slice_id
        self.children_list_type = "dynamic"


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


def get_vector_catalog_children(slice_id: str) -> BreadboxVectorCatalogNodeInfo:
    """
    Handle vector catalog /catalog/children/ requests which have breadbox slice IDs.
    Breadbox slice IDs should be formatted like breadbox/<dataset-uuid> or 
    breadbox/<dataset-uuid>/<feature-id>.
    """
    parsed_id = parse_breadbox_slice_id(slice_id)
    # if a dataset slice id was given, get the datasets features
    if parsed_id.feature_id is None:
        children = _get_feature_nodes(dataset_uuid=parsed_id.dataset_id)
    # if a feature slice ID was given, return an empty list
    else:
        # Breadbox feature nodes have no children
        children = []
    return BreadboxVectorCatalogNodeInfo(children=children, slice_id=slice_id)


def get_dataset_nodes(catalog_type: str) -> list[Node]:
    """"
    Get breadbox dataset information for all datasets which match the given catalog type (ex. "continuous").
    Return a list of objects similar to vector_catalog's Node type, but with only a 
    subset of the fields (those that are exposed by the vector_catalog endpoints).
    """
    bb_datasets = _get_matrix_datasets()
    dataset_types_for_catalog = _get_breadbox_value_types(catalog_type)
    # Convert to the format used by vector catalog
    result_nodes: list[Node] = []
    for bb_dataset in bb_datasets:
        if bb_dataset.value_type in dataset_types_for_catalog:
            slice_id = get_breadbox_slice_id(dataset_id=bb_dataset.id)
            child_node = BreadboxVectorCatalogChildNode(
                slice_id=slice_id,
                label=bb_dataset.name,
                value=slice_id,
                is_terminal=False,
            )
            result_nodes.append(child_node)
    return result_nodes


def _get_feature_nodes(dataset_uuid: str) -> list[Node]:
    bb_features = extensions.breadbox.client.get_dataset_features(dataset_uuid)
    feature_nodes: list[Node] = []
    for bb_feature in bb_features:
        slice_id = get_breadbox_slice_id(
            dataset_id=dataset_uuid, feature_id=bb_feature["id"]
        )
        child_node = BreadboxVectorCatalogChildNode(
            slice_id=slice_id,
            label=bb_feature["label"],
            value=bb_feature["label"],
            is_terminal=True,
        )
        feature_nodes.append(child_node)
    return feature_nodes


def get_breadbox_catalog_path(
    slice_id: str, catalog: str, legacy_nonstandard_dataset_nodes: list[Node]
) -> list[BreadboxVectorCatalogNodeInfo]:
    """
    Return a list one to two NodeInfo dictionaries. The first NodeInfo dict 
    should describe the breadbox dataset node specified in the given slice ID. 
    The second should describe the breadbox feature node (if one was specifeid in the
    given slice ID).
    """
    parsed_ids = parse_breadbox_slice_id(slice_id)
    # Append a node for the specified breadbox dataset
    dataset_node = _get_dataset_node_info_with_siblings(
        parsed_ids.dataset_id, catalog, legacy_nonstandard_dataset_nodes
    )
    nodes: list[BreadboxVectorCatalogNodeInfo] = [dataset_node]
    # If a feature was also specified in the requested slice ID, append a node for that
    if parsed_ids.feature_id:
        feature_node = _get_feature_node_info_with_siblings(
            dataset_uuid=parsed_ids.dataset_id, feature_id=parsed_ids.feature_id
        )
        nodes.append(feature_node)
    return nodes


def _get_feature_node_info_with_siblings(
    dataset_uuid: str, feature_id: str
) -> BreadboxVectorCatalogNodeInfo:
    siblings = _get_feature_nodes(dataset_uuid=dataset_uuid)
    feature_slice_id = get_breadbox_slice_id(
        dataset_id=dataset_uuid, feature_id=feature_id
    )
    return BreadboxVectorCatalogNodeInfo(children=siblings, slice_id=feature_slice_id)


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
    dataset_uuid = parse_breadbox_slice_id(dataset_slice_id).dataset_id
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
        dataset_id=dataset_uuid,
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


def _get_dataset_node_info_with_siblings(
    dataset_id: str, catalog: str, legacy_siblings: list[Node]
) -> BreadboxVectorCatalogNodeInfo:
    breadbox_siblings = get_dataset_nodes(catalog_type=catalog)
    dataset_slice_id = get_breadbox_slice_id(dataset_id)
    return BreadboxVectorCatalogNodeInfo(
        children=legacy_siblings + breadbox_siblings, slice_id=dataset_slice_id
    )


def _get_matrix_datasets() -> list[MatrixDatasetResponse]:
    """Get all datasets where the metadata contains {"show_in_vector_catalog": true}"""
    all_breadbox_datasets: list[
        Union[MatrixDatasetResponse, TabularDatasetResponse]
    ] = extensions.breadbox.client.get_datasets()
    vector_catalog_datasets = [
        dataset
        for dataset in all_breadbox_datasets
        if isinstance(dataset, MatrixDatasetResponse)
    ]
    return vector_catalog_datasets


def _get_breadbox_value_types(catalog: str) -> list[str]:
    # Note: assumes that the "binary" catalog should not contain breadbox datasets
    if catalog in [v.value for v in ValueType]:
        return [ValueType(catalog)]
    if catalog == Trees.continuous_and_categorical.name:
        return [ValueType.CONTINUOUS, ValueType.CATEGORICAL]
    else:
        return []
