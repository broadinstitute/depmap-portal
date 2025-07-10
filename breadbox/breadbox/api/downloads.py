from dataclasses import dataclass
from datetime import datetime
import os
from typing import Any, List, Optional
from logging import getLogger
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
)
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from breadbox.db.session import SessionWithUser
from breadbox.celery_task import utils

from breadbox.compute import download_tasks
from breadbox.crud.dataset import get_matching_feature_metadata_labels

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
    filename_for_user = name
    file_path_from_compute_results_dir = os.path.join(
        settings.compute_results_location, file_path
    )

    file_response = FileResponse(
        media_type="text/csv",
        filename=filename_for_user,
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
