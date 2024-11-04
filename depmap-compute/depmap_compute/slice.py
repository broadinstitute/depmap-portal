from dataclasses import dataclass
from typing import Literal

from urllib.parse import unquote


@dataclass
class SliceQuery:
    dataset_id: str
    identifier: str
    identifier_type: Literal[
        "feature_id", "feature_label", "sample_id", "sample_label", "column"
    ]


def decode_slice_id(slice_id) -> tuple[str, str, str]:
    """
    Originally based on the function of the same name from vector_catalog.SliceSerializer,
    Data Explorer 2 slice ids are a superset of the legacy slice ids.
    Originally, slice IDs were formatted like "slice/some_dataset_id/some_feature_label/label", 
    or "slice/some_dataset_id/some_feature_id/entity_id", where the last part of the string
    (originally called the SliceRowType) specifies whether the feature is being identified by ID or by label. 

    The DE2 slice IDs give you flexibility by letting you query samples as well using the "transpose_label" specifier.
    When "transpose_label" is used as the last segment of the slice ID, it means we should query for samples.
    """
    parts = slice_id.split("/")
    assert (
        parts[0] == "slice" and len(parts) >= 4 and len(parts) <= 5
    ), f"Malformed slice_id: {slice_id}"

    if len(parts) == 5:
        # handle dataset IDs with slashes in them
        parts[1:3] = ["/".join(parts[1:3])]

    dataset_id = unquote(parts[1])
    dimension_identifier = unquote(parts[2])
    slice_type = unquote(parts[3])  # "label", "entity_id", or "transpose_label"

    return dataset_id, dimension_identifier, slice_type
