from dataclasses import dataclass
import re
from typing import Any, Optional

from breadbox_client.models.value_type import ValueType
from breadbox_client.models import MatrixDatasetResponse
from depmap.data_access.models import MatrixDataset


from flask import abort


BREADBOX_DATASET_ID_REGEX = "breadbox/([^/]+)"
BREADBOX_SLICE_ID_REGEX = f"{BREADBOX_DATASET_ID_REGEX}(?:/([^/]+))?"


@dataclass
class ParsedBreadboxSliceId:
    dataset_id: str
    feature_id: Optional[str]


def parse_breadbox_slice_id(slice_id: str) -> ParsedBreadboxSliceId:
    """
    Parse the breadbox dataset ID and feature ID from the given slice ID. If the given 
    slice ID is malformed, throw a Bad Request error. Slice IDs should be formatted like 
    'breadbox/<dataset-uuid>/<feature-uuid>' or 'breadbox/<dataset-uuid>'.
    """
    match = re.match(BREADBOX_SLICE_ID_REGEX, slice_id)
    assert match, f"Breadbox slice id '{slice_id}' does not match the expected format."
    return ParsedBreadboxSliceId(match.group(1), match.group(2))


def remove_breadbox_prefix(dataset_id: str) -> str:
    """
    If a dataset ID belongs to a breadbox dataset, it either:
    - is a dataset's ID prefixed with "breadbox/" 
    - or is a breadbox dataset's given id
    However, when we make a request to breadbox, we don't want to pass the prefix,
    so we strip the prefix off here if it has one.
    """
    match = re.match(BREADBOX_SLICE_ID_REGEX, dataset_id)
    if match:
        return match.group(1)
    return dataset_id


def is_breadbox_id_format(id: str):
    """Check if the ID matches eitherbreadbox dataset format (prefixed by "breadbox/")"""
    breadbox_match = re.match(BREADBOX_SLICE_ID_REGEX, id)
    return breadbox_match is not None


def get_breadbox_slice_id(dataset_id: str, feature_id: Optional[str] = None):
    """Construct a correctly formatted breadbox slice ID."""
    slice_id = f"breadbox/{dataset_id}"
    if feature_id:
        slice_id += f"/{feature_id}"
    return slice_id


def format_breadbox_task_status(breadbox_task_status: dict[str, Any]):
    """
    Convert a breadbox task status response into a format the portal can handle
    by pre-pending task ids with the "breadbox" prefix. 
    """
    breadbox_task_status["id"] = f"breadbox/{breadbox_task_status['id']}"
    if breadbox_task_status["state"] == "SUCCESS":
        assert (
            breadbox_task_status.get("result") is not None
        ), "Breadbox task success response does not have a result"
        assert (
            breadbox_task_status["result"].get("taskId") is not None
        ), "Breadbox task result does not have a task ID"
        breadbox_task_status["result"][
            "taskId"
        ] = f"breadbox/{breadbox_task_status['result']['taskId']}"
    return breadbox_task_status


def parse_matrix_dataset_response(dataset: MatrixDatasetResponse) -> MatrixDataset:
    feature_type = (
        dataset.feature_type_name
        if dataset.feature_type_name
        else f"{dataset.name} Feature"
    )
    return MatrixDataset(
        id=f"breadbox/{dataset.id}",
        given_id=dataset.given_id if dataset.given_id else None,
        label=dataset.name,
        data_type=dataset.data_type,
        feature_type=feature_type,
        sample_type=dataset.sample_type_name,
        priority=dataset.priority if dataset.priority else None,
        taiga_id=dataset.taiga_id if dataset.taiga_id else None,
        units=dataset.units,
        is_continuous=dataset.value_type == ValueType.CONTINUOUS,
    )
