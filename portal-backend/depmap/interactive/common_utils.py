from collections import namedtuple
from typing import List

import pandas as pd

from depmap.interactive import interactive_utils
from depmap.dataset.models import BiomarkerDataset
from depmap.interactive.models import Feature

# index refers to index in matrix
RowSummary = namedtuple("RowSummary", "index entity_id label")


def sort_insensitive(value_list):
    return sorted(value_list, key=lambda x: x.casefold())


def format_features_from_value(value_list):
    return [{"label": x, "value": x} for x in value_list]


def format_features_from_label_aliases(label_aliases_list):
    features = []
    for entity_label, aliases in label_aliases_list:
        if len(aliases) > 0:
            feature_label = "{} ({})".format(entity_label, ", ".join(aliases))
        else:
            feature_label = entity_label
        features.append({"label": feature_label, "value": entity_label})
    return features


def format_axis_label(dataset: str, feature: str) -> str:
    """Only called with legacy datasets/features, does not work with breadbox."""
    if dataset == BiomarkerDataset.BiomarkerEnum.mutations_prioritized.name:
        return feature + " Mutations"
    units = interactive_utils.get_dataset_units(dataset)
    if units is None:
        units = ""
    else:
        units = " " + units

    if interactive_utils.has_opaque_features(dataset):
        # exception for custom cell line groups, feature is a uuid
        feature_label = ""
    else:
        feature_label = feature
    return feature_label + units + "<br>" + interactive_utils.get_dataset_label(dataset)


def get_features_from_ungrouped_df(
    df: pd.DataFrame,
    feature_labels: List[str],
    axis_labels: List[str],
    feature_ids: List[str],
) -> List[Feature]:
    features: List[Feature] = [
        Feature(feature_id, list(df[feature_id]), feature_labels[i], axis_labels[i],)
        for i, feature_id in enumerate(feature_ids)
    ]
    return features
