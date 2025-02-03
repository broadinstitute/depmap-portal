import numpy as np
import pandas as pd
from flask import abort
from typing import Literal, Optional
from collections import defaultdict

from depmap_compute.context import LegacyContextEvaluator
from depmap_compute.slice import decode_slice_id
from depmap import data_access
from depmap.data_access.models import MatrixDataset
from depmap.utilities.data_access_log import log_dataset_access
from depmap.data_explorer_2.datatypes import hardcoded_metadata_slices
from depmap.data_explorer_2.utils import (
    get_aliases_matching_labels,
    get_dimension_labels_across_datasets,
    get_reoriented_df,
    get_union_of_index_labels,
    get_vector_labels,
    pluralize,
    slice_to_dict,
    to_display_name,
)


aggFunctions = {
    "mean": np.mean,
    "median": np.median,
    "25%tile": lambda x: np.percentile(x, 25),
    "75%tile": lambda x: np.percentile(x, 75),
}


def compute_dimension(
    dimension, index_type, sort: Optional[Literal["asc", "desc"]] = None
):
    dataset_id = dimension["dataset_id"]
    context = dimension["context"]
    aggregation = dimension["aggregation"]
    dataset = data_access.get_matrix_dataset(dataset_id)
    is_transpose = dataset.feature_type == index_type

    if aggregation == "correlation":
        print("dimension:", dimension)
        raise ValueError(
            "compute_dimension() called with `aggregation == 'correlation'."
            "Use the /get_correlation endpoint for this!"
        )

    # record to the log which data users request
    log_dataset_access("compute_dimension", dataset_id)

    context_evaluator = LegacyContextEvaluator(context, slice_to_dict)

    col_labels = get_vector_labels(dataset_id, not is_transpose)
    row_labels = get_vector_labels(dataset_id, is_transpose)

    filtered_row_labels = [
        label for label in row_labels if context_evaluator.is_match(label)
    ]

    indexed_values = {}

    if len(filtered_row_labels) > 0:
        # get primary dimension and everything else for other dimension
        df = get_reoriented_df(
            dataset_id, filtered_row_labels, col_labels, is_transpose
        )

        if not df.empty:
            aggregated = (
                df.squeeze("rows")
                if aggregation == "first"
                else df.agg(aggFunctions[aggregation])
            )
            assert isinstance(aggregated, pd.Series)
            values = aggregated.dropna()

            if sort is not None:
                asc: bool = sort == "asc"
                values = values.sort_values(ascending=asc)

            indexed_values = values.to_dict()

    if aggregation == "first" and len(filtered_row_labels) == 0:
        return abort(400)

    single_slice_label = filtered_row_labels[0] if aggregation == "first" else None

    axis_label = _get_axis_label(
        single_slice_label,
        dataset,
        is_transpose,
        aggregation,
        context["name"],
        len(filtered_row_labels),
    )

    return {
        "dataset_id": dataset_id,
        "dataset_label": dataset.label,
        "axis_label": axis_label,
        "slice_type": dimension["slice_type"],
        "indexed_values": indexed_values,
    }


def compute_filter(input_filter):
    indexed_values = {}
    context_evaluator = LegacyContextEvaluator(input_filter, slice_to_dict)
    index_labels = get_dimension_labels_across_datasets(input_filter["context_type"])

    for label in index_labels:
        indexed_values[label] = context_evaluator.is_match(label)

    return {"name": input_filter["name"], "indexed_values": indexed_values}


def compute_metadata(metadata):
    slice_id = metadata["slice_id"]
    indexed_values = slice_to_dict(slice_id)
    label = None

    # HACK: Look up a label for the `slice_id` in `hardcoded_metadata_slices`.
    # When we stop relying on Slice IDs and start using SliceQuery objects,
    # perhaps we could include `label` as an optional field.
    for slices in hardcoded_metadata_slices.values():
        for m_slice_id, info in slices.items():
            if m_slice_id == slice_id:
                label = info["name"]
            elif info.get("isPartialSliceId", False) and m_slice_id in slice_id:
                _, identifier, _ = decode_slice_id(slice_id)
                label = f"{info['name']} ({info['sliceTypeLabel']} = {identifier})"

    if label is None:
        dataset_id, identifier, _ = decode_slice_id(slice_id)
        dataset = data_access.get_matrix_dataset(dataset_id)
        label = f"{identifier} {dataset.label}"

    return {
        "label": label,
        "slice_id": slice_id,
        "indexed_values": indexed_values,
    }


def compute_all(index_type, dimensions, filters, metadata):
    dataset_ids = [d["dataset_id"] for d in dimensions.values()]
    index_labels = get_union_of_index_labels(index_type, dataset_ids)
    index_aliases = get_aliases_matching_labels(index_type, index_labels)

    output_dimensions = {}
    output_filters = {}
    output_metadata = {}

    for dimension_key, dimension in dimensions.items():
        dimension = compute_dimension(dimension, index_type)
        indexed_values = dimension["indexed_values"]
        output_dimensions[dimension_key] = {
            "dataset_id": dimension["dataset_id"],
            "dataset_label": dimension["dataset_label"],
            "axis_label": dimension["axis_label"],
            "slice_type": dimension["slice_type"],
            "values": [indexed_values.get(label, None) for label in index_labels],
        }

    for filter_key, input_filter in filters.items():
        computed_filter = compute_filter(input_filter)
        indexed_values = computed_filter["indexed_values"]
        output_filters[filter_key] = {
            "name": input_filter["name"],
            "values": [indexed_values.get(label, None) for label in index_labels],
        }

    for metadata_key, input_metadata in metadata.items():
        computed_metadata = compute_metadata(input_metadata)
        indexed_values = computed_metadata["indexed_values"]
        output_metadata[metadata_key] = {
            "slice_id": input_metadata["slice_id"],
            "values": [indexed_values.get(label, None) for label in index_labels],
        }

    return {
        "index_type": index_type,
        "index_labels": index_labels,
        "index_aliases": index_aliases,
        "dimensions": output_dimensions,
        "filters": output_filters,
        "metadata": output_metadata,
    }


def compute_waterfall(index_type, dimensions, filters, metadata):
    output_dimensions = {}
    output_filters = {}
    output_metadata = {}

    primary_dimension = compute_dimension(dimensions["x"], index_type, sort="asc")
    indexed_values = primary_dimension["indexed_values"]
    categorical_colors = None

    # Handle the special case where we want to recompute the index to be
    # grouped by categorical colors (Josh has dubbed this type of thing a
    # "Sidney plot")
    if metadata and "color_property" in metadata:
        grouped = defaultdict(list)
        input_metadata = metadata["color_property"]
        categorical_colors = compute_metadata(input_metadata)

        for key, value in indexed_values.items():
            group = categorical_colors["indexed_values"].get(key, None)
            grouped[group].append((key, value))

        # TODO: Move this calculation to the frontend so groups can be sorted
        # in various ways (similar to the Density 1D plot type).
        grouped = dict(sorted(grouped.items(), key=lambda x: (x[0] is None, x[0])))
        indexed_values = {}

        for pairs in grouped.values():
            for (key, value) in pairs:
                indexed_values[key] = value

    index_labels = list(indexed_values.keys())
    index_aliases = get_aliases_matching_labels(index_type, index_labels)

    output_dimensions["x"] = {
        "dataset_id": primary_dimension["dataset_id"],
        "dataset_label": "",
        "axis_label": "Rank" if categorical_colors is None else "",
        "slice_type": primary_dimension["slice_type"],
        "values": list(range(0, len(index_labels))),
    }

    output_dimensions["y"] = {
        "dataset_id": primary_dimension["dataset_id"],
        "dataset_label": primary_dimension["dataset_label"],
        "axis_label": primary_dimension["axis_label"],
        "slice_type": primary_dimension["slice_type"],
        "values": [indexed_values.get(label, None) for label in index_labels],
    }

    if "color" in dimensions:
        color_dimension = compute_dimension(dimensions["color"], index_type)
        output_dimensions["color"] = {
            "dataset_id": color_dimension["dataset_id"],
            "dataset_label": color_dimension["dataset_label"],
            "axis_label": color_dimension["axis_label"],
            "slice_type": color_dimension["slice_type"],
            "values": [
                color_dimension["indexed_values"].get(label, None)
                for label in index_labels
            ],
        }

    for filter_key, input_filter in filters.items():
        computed_filter = compute_filter(input_filter)
        indexed_values = computed_filter["indexed_values"]
        output_filters[filter_key] = {
            "name": input_filter["name"],
            "values": [indexed_values.get(label, None) for label in index_labels],
        }

    for metadata_key, input_metadata in metadata.items():
        computed_metadata = {}

        if metadata_key == "color_property":
            computed_metadata = categorical_colors
        else:
            computed_metadata = compute_metadata(input_metadata)

        indexed_values = computed_metadata["indexed_values"]  # type: ignore
        output_metadata[metadata_key] = {
            "label": computed_metadata["label"],
            "slice_id": input_metadata["slice_id"],
            "values": [indexed_values.get(label, None) for label in index_labels],
        }

    return {
        "index_type": index_type,
        "index_labels": index_labels,
        "index_aliases": index_aliases,
        "dimensions": output_dimensions,
        "filters": output_filters,
        "metadata": output_metadata,
    }


def _get_axis_label(
    single_slice_label: Optional[str],
    dataset: MatrixDataset,
    is_transpose: bool,
    aggregation: str,
    context_name: str,
    context_count: int,
):
    dimension_type = dataset.feature_type if not is_transpose else dataset.sample_type
    units = dataset.units

    if single_slice_label:
        axis_label = single_slice_label

        if dimension_type == "depmap_model":
            index_aliases = get_aliases_matching_labels(
                "depmap_model", [single_slice_label]
            )
            for alias in index_aliases:
                if alias["slice_id"] == "slice/cell_line_display_name/all/label":
                    axis_label = f"{alias['values'][0]} ({axis_label})"
        if units:
            axis_label += " " + units
        return axis_label

    entities = pluralize(to_display_name(dimension_type or ""))
    return f"{aggregation} {units} of {context_count} {context_name} {entities}"
