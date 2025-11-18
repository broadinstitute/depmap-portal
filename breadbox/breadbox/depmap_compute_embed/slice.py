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


def slice_id_to_slice_query(slice_id: str) -> SliceQuery:
    """Take a legacy slice ID string and convert it to the newer slice query format."""
    dataset_id, dimension_identifier, slice_type = decode_slice_id(slice_id)

    slice_query_identifier_type: Literal["feature_label", "sample_id", "feature_id"]

    # Slice query identifier types use different (more descriptive) terminology
    if slice_type == "label":
        slice_query_identifier_type = "feature_label"
    elif slice_type == "transpose_label":
        # "transpose_label" is a deprecated slice type used in data explorer 2 to reference sample IDs.
        # Historically, sample IDs were always displayed to users, so it made some sense to call them the "labels".
        # However, breadbox allows samples to have separate labels (ex. cell line names), which aren't just the IDs.
        # It now makes more sense to call this identifier type "sample_id".
        slice_query_identifier_type = "sample_id"
    elif slice_type == "entity_id":
        # "entity_id" is only used in older parts of the codebase (not DE2 or ContextManager)
        assert not dataset_id.startswith(
            "breadbox/"
        ), "Breadbox datasets do not support lookups by entity_id"
        slice_query_identifier_type = "feature_id"
    else:
        raise NotImplementedError(f"Unknown slice type: {slice_type}")

    return SliceQuery(
        dataset_id=dataset_id,
        identifier=dimension_identifier,
        identifier_type=slice_query_identifier_type,
    )
