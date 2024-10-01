import re
import gzip
import functools
import numpy as np
import pandas as pd
from typing import Any, Optional
from collections import defaultdict
from logging import getLogger
from flask import abort, json, make_response

from depmap_compute.context import decode_slice_id, ContextEvaluator
from depmap_compute.slice import SliceQuery
from depmap import data_access
from depmap.data_access.models import MatrixDataset
from depmap.settings.download_settings import get_download_list
from depmap.data_explorer_2.datatypes import (
    blocked_dimension_types,
    entity_aliases,
)

log = getLogger(__name__)


@functools.cache
def get_vector_labels(dataset_id: str, is_transpose: bool) -> list[str]:
    """
    DEPRECATED: this does not use the definition of "labels" that we are using
    going forward. For samples, this returns IDs as labels. 
    Load all labels for an axis of the given dataset.
    If is_transpose, then get depmap_ids/sample labels.
    Otherwise, get sample/feature labels.
    """
    if is_transpose:
        return data_access.get_dataset_sample_ids(dataset_id)

    return data_access.get_dataset_feature_labels(dataset_id)


def get_dimension_labels_of_dataset(dimension_type: str, dataset: MatrixDataset):
    """
    DEPRECATED: this does not use the definition of "labels" that we are using
    going forward. For samples, this returns IDs as labels. 
    """
    if dimension_type not in (dataset.feature_type, dataset.sample_type):
        return set()

    is_transpose = dimension_type == dataset.sample_type

    labels = get_vector_labels(dataset.id, is_transpose)
    return set(labels)


def get_reoriented_df(
    dataset_id: str,
    row_labels: Optional[list[str]],
    col_labels: Optional[list[str]],
    is_transpose: bool,
) -> pd.DataFrame:
    """
    Load a dataframe with values filtered by the given labels. Transform if applicable.
    The given labels given specify the rows/columns of the output (after the dataset is transposed).
    """
    if is_transpose:
        # Load the subsetted DF (with flipped row/column arguments), then transpose
        return data_access.get_subsetted_df_by_labels(
            dataset_id=dataset_id,
            feature_row_labels=col_labels,
            sample_col_ids=row_labels,
        ).transpose()

    return data_access.get_subsetted_df_by_labels(
        dataset_id=dataset_id, feature_row_labels=row_labels, sample_col_ids=col_labels,
    )


# There are also several bespoke slice IDs here that don't correlate with real
# datasets. For example, there is no "gene_essentiality" dataset. Those data
# are drawn from the gene_exective_info table in the sqlite db.
def get_series_from_de2_slice_id(slice_id: str) -> pd.Series:
    """
    Data Explorer 2 slice ids are a superset of legacy slice ids.
    One difference is that DE2 slice ids can include "transpose_label"
    as a feature type, which indicates that the result should be transposed.
    "transpose_label" is used similarly to the "depmap_model" feature type in slice ids.
    """
    dataset_id, feature_label, feature_type = decode_slice_id(slice_id)

    # Handle special cases
    if slice_id == "slice/compound_experiment/compound_name/label":
        return get_compound_experiment_compound_name_series()
    if slice_id == "slice/compound_experiment/compound_instance/label":
        return get_compound_experiment_compound_instance_series()
    if slice_id.startswith("slice/mutations_prioritized/"):
        return get_mutations_prioritized_series(dataset_id, feature_label)

    is_transpose = feature_type == "transpose_label"
    if is_transpose and data_access.is_continuous(dataset_id):
        # For transposed slice ids we need to load a single-column dataframe
        # even though the implementation of this can't handle categorical data
        single_col_df = data_access.get_subsetted_df_by_labels(
            dataset_id=dataset_id,
            feature_row_labels=None,
            sample_col_ids=[feature_label],
        )
        return single_col_df[feature_label]
    if not is_transpose:
        # This is currently the only way to load categorical data from the
        # legacy backend
        return data_access.get_row_of_values(dataset_id, feature_label)

    raise NotImplementedError(
        f"Unable to load a transposed non-continuous dataset (slice_id: {slice_id})"
    )


def slice_to_dict(slice_id: str) -> dict[str, Any]:
    """For the given slice ID, load a dictionary of values keyed by label."""
    return get_series_from_de2_slice_id(slice_id).replace({np.nan: None}).to_dict()


# based on https://github.com/hmallen/numpyencoder/blob/f8199a6/numpyencoder/numpyencoder.py
def to_serializable_numpy_number(obj):
    if isinstance(
        obj,
        (
            np.int_,
            np.intc,
            np.intp,
            np.int8,
            np.int16,
            np.int32,
            np.int64,
            np.uint8,
            np.uint16,
            np.uint32,
            np.uint64,
        ),
    ):
        return int(obj)

    if isinstance(obj, (np.float_, np.float16, np.float32, np.float64)):
        return float(obj)

    if isinstance(obj, (np.complex_, np.complex64, np.complex128)):
        return {"real": obj.real, "imag": obj.imag}

    return obj


# This is not really needed. It's just an experimental optimization.
# This should really happen at the Nginx level.
# https://app.asana.com/0/0/1201078871707042/f
def make_gzipped_json_response(obj):
    content_as_json = json.dumps(obj, ensure_ascii=False).encode("utf8")
    content = gzip.compress(content_as_json)

    response = make_response(content)
    response.headers["Content-length"] = len(content)
    response.headers["Content-Type"] = "application/json; charset=utf-8"
    response.headers["Content-Encoding"] = "gzip"

    return response


def get_compound_experiment_compound_name_series():
    dictionary = {}
    labels = get_dimension_labels_across_datasets("compound_experiment")

    for label in labels:
        compound_name = re.search(r"(.*) ((?<!-)\(.*)", label).groups()[0]
        dictionary[label] = compound_name

    return pd.Series(dictionary)


def get_compound_experiment_compound_instance_series():
    dictionary = {}
    labels = get_dimension_labels_across_datasets("compound_experiment")

    for label in labels:
        compound_instance = re.search(r"(.*) ((?<!-)\(.*)", label).groups()[1]
        dictionary[label] = compound_instance

    return pd.Series(dictionary)


def get_mutations_prioritized_series(dataset_id: str, feature: str):
    series = data_access.get_row_of_values(dataset_id=dataset_id, feature=feature)

    for feature_label, value in series.items():
        # We throw out "Other" values because Data Explorer 2 labels NA values
        # as "Other", sometimes leading to two different types of "Other" being
        # displayed at once. As far as I can tell, these should actually be
        # considered NAs (i.e. points for which we have no data) and not "other
        # unspecified mutations."
        if value == "Other":
            series[feature_label] = None

    return series


def get_dimension_labels_across_datasets(dimension_type):
    all_labels = set()

    for dataset in get_all_supported_continuous_datasets():
        labels = get_dimension_labels_of_dataset(dimension_type, dataset)
        all_labels = all_labels.union(labels)

    return sorted(list(all_labels))


def get_all_dimension_labels_by_id(dimension_type: str) -> dict[str, str]:
    """Get all dimension labels and IDs across datasets."""
    all_labels_by_id = {}
    # For each dataset, if it has the dimension type, get its IDs and labels
    for dataset in get_all_supported_continuous_datasets():
        if dimension_type == dataset.sample_type:
            dataset_labels_by_id = data_access.get_dataset_sample_labels_by_id(
                dataset.id
            )
        elif dimension_type == dataset.feature_type:
            dataset_labels_by_id = data_access.get_dataset_feature_labels_by_id(
                dataset.id
            )
        else:
            dataset_labels_by_id = {}

        all_labels_by_id.update(dataset_labels_by_id)

    return all_labels_by_id


def get_dimension_labels_to_datasets_mapping(dimension_type: str):
    """
    Takes a `dimension_type` and returns a dictionary like:
    {
      "dataset_ids": [
        "copy_number_absolute",
        "Chronos_Combined",
        "expression"
      ],

      # Order matches "datset_ids" above.
      "dataset_labels": [
        "Copy Number (Absolute)",
        "CRISPR (DepMap Internal 23Q4+Score, Chronos)",
        "Expression Internal 23Q4"
      ],

      # Each label maps to a list of integers that correspond to indices into
      # the "dataset_ids" array. This can be used to to determine which
      # datasets a given label can be found in.
      "dimension_labels": {
        "ANOS1":  [1, 2],
        "HNF1B":  [0, 1, 2],
        "KDM7A":  [0, 1, 2],
        "MAP4K4": [0, 1, 2],
        "MED1":   [0, 1, 2],
        "NRAS":   [0, 1, 2],
        "SOX10":  [0, 1, 2],
        "SWI5":   [0, 1, 2]
      },

      # Same format as "dimension_labels" above. Answers the question
      # "which datasets are part of a given data type?"
      "data_types": {
        "CN": [0],
        "CRISPR": [1],
        "Expression": [2]
      },

      # Same idea as above.
      "units": {
        "Copy Number": [0],
        "Gene Effect (Chronos)": [1],
        "log2(TPM+1)": [2]
      }
    }
    """
    all_labels = defaultdict(list)
    data_types = defaultdict(list)
    units = defaultdict(list)
    dataset_ids = []
    dataset_labels = []

    for dataset in get_all_supported_continuous_datasets():
        if dimension_type not in (dataset.feature_type, dataset.sample_type):
            continue

        index = len(dataset_ids)
        dataset_ids.append(dataset.id)
        dataset_labels.append(dataset.label)
        data_types[dataset.data_type].append(index)
        units[dataset.units].append(index)

        for label in get_dimension_labels_of_dataset(dimension_type, dataset):
            all_labels[label].append(index)

    sorted_labels = {key: all_labels[key] for key in sorted(all_labels.keys())}

    return {
        "units": units,
        "dimension_labels": sorted_labels,
        "data_types": data_types,
        "dataset_ids": dataset_ids,
        "dataset_labels": dataset_labels,
    }


def get_datasets_from_dimension_type(dimension_type: str) -> list[MatrixDataset]:
    datasets = []

    for dataset in get_all_supported_continuous_datasets():
        if dimension_type == dataset.feature_type:
            datasets.append(dataset)
        elif dimension_type == dataset.sample_type:
            datasets.append(dataset)

    return datasets


def get_all_supported_continuous_datasets() -> list[MatrixDataset]:
    out = []

    for dataset in data_access.get_all_matrix_datasets():

        if not dataset.is_continuous:
            continue
        if dataset.feature_type is None:
            continue
        if dataset.feature_type in blocked_dimension_types:
            continue
        if dataset.sample_type in blocked_dimension_types:
            continue

        if dataset.data_type is None:
            log.warning(
                "Data Explorer 2: No data_type defined for dataset '%s'. ", dataset.id,
            )
        if dataset.units is None:
            log.warning(
                "Data Explorer 2: No units defined for dataset '%s'. ", dataset.id,
            )

        if dataset.data_type is None or dataset.units is None:
            continue

        out.append(dataset)

    return out


def get_file_and_release_from_dataset(dataset: MatrixDataset):
    downloads = get_download_list()
    taiga_id = dataset.taiga_id

    if taiga_id is not None:
        for release in downloads:
            for file in release.all_files:
                if file.name != "README.txt" and file.taiga_id == taiga_id:
                    return file, release

    return None, None


def get_aliases_matching_labels(dimension_type, labels):
    aliases = []

    if dimension_type in entity_aliases:
        for alias in entity_aliases[dimension_type]:
            values = []
            values_by_label = slice_to_dict(alias["slice_id"])

            for label in labels:
                values.append(values_by_label.get(label, None))

            aliases.append(
                {
                    "label": alias["label"],
                    "slice_id": alias["slice_id"],
                    "values": values,
                }
            )

    return aliases


def pluralize(dimension_type: str):
    return re.sub(r"y$", "ie", dimension_type) + "s"


def to_display_name(dimension_type: str):
    if dimension_type == "depmap_model":
        return "model"

    if dimension_type == "compound_experiment":
        return "compound"

    if dimension_type == "msigdb_gene_set":
        return "MSigDB gene set"

    if dimension_type == "other":
        return "point"

    return re.sub(r"_", " ", dimension_type)


def get_union_of_index_labels(index_type, dataset_ids):
    # one dimension might have fewer index values (points)
    union_of_labels = set()

    for dataset_id in dataset_ids:
        feature_type = data_access.get_dataset_feature_type(dataset_id)
        sample_type = data_access.get_dataset_sample_type(dataset_id)

        if index_type not in (sample_type, feature_type):
            raise ValueError(
                f"Dataset '{dataset_id}' is not indexable by '{index_type}'! "
                f"Its feature_type is '{feature_type}' and sample_type is '{sample_type}'."
            )

        is_transpose = feature_type == index_type
        labels = get_vector_labels(dataset_id, not is_transpose)
        union_of_labels = union_of_labels.union(labels)

    return sorted(list(union_of_labels))


def clear_cache():
    get_vector_labels.cache_clear()
