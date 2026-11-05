from dataclasses import dataclass
from datetime import datetime
import os
from typing import Any, List, Optional
from logging import getLogger
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from breadbox.db.session import SessionWithUser
from breadbox.celery_task import utils

from breadbox.compute import download_tasks
from breadbox.crud.dimension_ids import get_matching_feature_metadata_labels

from ..config import Settings, get_settings
from .dependencies import get_user, get_db_with_user


router = APIRouter(prefix="/downloads", tags=["downloads"])
log = getLogger(__name__)


class ExportDatasetParams(BaseModel):
    # The ID of the dataset to download
    datasetId: str
    # A list of feature labels to subset the selected dataset by.  If null, return all features in the dataset.
    featureLabels: Optional[List[str]] = None
    # A list of sample ID's to subset datasets by.  If null, return all cell lines in the dataset.
    cellLineIds: Optional[List[str]] = None
    # If true, rows and columns will be dropped if the entire row or entire column only contains NAs.
    dropEmpty: Optional[bool] = False
    # If true, add metadata (name, lineages) to csv .
    addCellLineMetadata: Optional[bool] = False


class ExportMergedDatasetParams(BaseModel):
    # The IDs of the datasets to merge for download
    datasetIds: List[str]
    # A list of feature labels to subset the selected dataset by.  If null, return all features in the dataset.
    featureLabels: Optional[List[str]] = None
    # A list of sample ID's to subset datasets by.  If null, return all cell lines in the dataset.
    cellLineIds: Optional[List[str]] = None
    # If true, rows and columns will be dropped if the entire row or entire column only contains NAs.
    dropEmpty: Optional[bool] = False
    # If true, add metadata (name, lineages) to csv .
    addCellLineMetadata: Optional[bool] = False


class ExportDatasetResponse(BaseModel):
    state: str
    id: str
    message: Annotated[Optional[str], Field()] = None
    result: Annotated[Optional[Any], Field()] = None
    percentComplete: Annotated[Optional[int], Field()] = None


@router.post(
    "/custom", operation_id="export_dataset", response_model=ExportDatasetResponse,
)
def export_dataset(
    exportParams: ExportDatasetParams,
    user: str = Depends(get_user),
    settings: Settings = Depends(get_settings),
):
    dataset_id = exportParams.datasetId
    feature_labels = exportParams.featureLabels
    sample_ids = exportParams.cellLineIds
    drop_nas = exportParams.dropEmpty
    add_metadata = exportParams.addCellLineMetadata

    assert dataset_id is not None

    result_dir = os.path.join(
        settings.compute_results_location, str(datetime.now().strftime("%Y%m%d")),
    )

    result = utils.cast_celery_task(download_tasks.export_dataset).delay(
        dataset_id,
        feature_labels,
        sample_ids,
        drop_nas,
        add_metadata,
        result_dir,
        user,
    )

    return utils.format_task_status(result)


@router.post(
    "/custom_merged",
    operation_id="export_merged_dataset",
    response_model=ExportDatasetResponse,
)
def export_merged_dataset(
    exportParams: ExportMergedDatasetParams,
    user: str = Depends(get_user),
    settings: Settings = Depends(get_settings),
):
    dataset_ids = exportParams.datasetIds
    feature_labels = exportParams.featureLabels
    sample_ids = exportParams.cellLineIds
    drop_nas = exportParams.dropEmpty
    add_metadata = exportParams.addCellLineMetadata

    assert len(dataset_ids) > 1

    result_dir = os.path.join(
        settings.compute_results_location, str(datetime.now().strftime("%Y%m%d")),
    )

    result = utils.cast_celery_task(download_tasks.export_merged_datasets).delay(
        dataset_ids,
        feature_labels,
        sample_ids,
        drop_nas,
        add_metadata,
        result_dir,
        user,
    )

    return utils.format_task_status(result)


@router.get("/data_slicer/download",)
def data_slicer_download(
    name: str, file_path: str, settings: Settings = Depends(get_settings)
):
    # `name` is only used as the download filename shown to the user, so it must
    # be a bare filename: no path separators, no traversal, no null bytes.
    if (
        not name
        or "/" in name
        or "\\" in name
        or ".." in name
        # reject control characters (incl. CR/LF and null) so the name can never
        # affect the Content-Disposition header, regardless of framework behavior
        or any(ord(c) < 0x20 or ord(c) == 0x7F for c in name)
    ):
        raise HTTPException(400, "Invalid name")

    # `file_path` is generated server side as <YYYYMMDD>/<task_id>/export.csv
    # (relative to the compute results dir). Reject anything else.
    if "\0" in file_path or "\\" in file_path or file_path.startswith("/"):
        raise HTTPException(400, "Invalid file_path")
    parts = file_path.split("/")
    if len(parts) != 3 or any(p in ("", ".", "..") or ".." in p for p in parts):
        raise HTTPException(400, "Invalid file_path")

    # Resolve the final path and confirm it is still inside the results dir.
    # realpath (rather than abspath) also collapses symlinks.
    results_root = os.path.realpath(settings.compute_results_location)
    file_path_from_compute_results_dir = os.path.realpath(
        os.path.join(results_root, file_path)
    )
    if not file_path_from_compute_results_dir.startswith(results_root + os.sep):
        raise HTTPException(400, "Invalid file_path")

    if not os.path.isfile(file_path_from_compute_results_dir):
        raise HTTPException(404, "File not found")

    file_response = FileResponse(
        media_type="text/csv",
        filename=name,
        path=file_path_from_compute_results_dir,
        content_disposition_type="attachment",
    )

    return file_response


@dataclass
class FeatureValidationQuery:
    featureLabels: List[str]


@router.post("/data_slicer/validate_data_slicer_features", response_model=dict)
def validate_data_slicer_features(
    query: FeatureValidationQuery, db: SessionWithUser = Depends(get_db_with_user),
):
    """
    From the given list of feature_labels, determine which are valid metadata labels
    in any dataset (case-insensitive). Return lists of both valid and invalid labels.

    Warning: For simplicity's sake, this is only returning metadata labels as "valid".
    If we want this to work for datasets that don't have metadata (that use their given ids as labels), 
    we'll need to make some changes to the implementation of this endpoint. 
    """
    feature_labels = query.featureLabels

    valid_feature_labels = get_matching_feature_metadata_labels(db, feature_labels)
    lowercase_valid_feature_labels = [label.lower() for label in valid_feature_labels]

    invalid_feature_labels = [
        feature
        for feature in feature_labels
        if feature.lower() not in lowercase_valid_feature_labels
    ]
    return {"valid": valid_feature_labels, "invalid": invalid_feature_labels}
