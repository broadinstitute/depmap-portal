import datetime
import os
from typing import List, Optional, Union
from logging import getLogger
from fastapi import APIRouter, HTTPException, Depends

from breadbox.config import Settings, get_settings
from depmap_compute import models

from breadbox.schemas.custom_http_exception import UserError
from ..schemas.compute import ComputeParams, ComputeResponse
from ..compute import analysis_tasks
from .dependencies import get_user
from ..celery_task import utils


router = APIRouter(prefix="/compute", tags=["compute"])
log = getLogger(__name__)


def _get_vector_is_dependent(
    analysis_type: str, vector_variable_type: Optional[str] = None
) -> Union[bool, None]:
    if analysis_type == models.AnalysisType.pearson:
        assert vector_variable_type is None
        vector_is_dependent = None
    else:
        vector_is_dependent = vector_variable_type == "dependent"

    return vector_is_dependent


def _validate_parameters(
    analysis_type: str,
    query_feature_id: Optional[str],
    query_dataset_id: Optional[str],
    query_values: Optional[List[str]],
    depmap_model_ids: Optional[List[str]],
):
    has_query_identifiers = query_feature_id and query_dataset_id
    if (
        analysis_type == models.AnalysisType.pearson
        or analysis_type == models.AnalysisType.association
    ):
        # Values can be specified with either the query_id or query_values
        assert (has_query_identifiers and not query_values) or (
            query_values and not has_query_identifiers
        )
    elif analysis_type == models.AnalysisType.two_class:
        assert not has_query_identifiers
        assert depmap_model_ids
        assert query_values
    else:
        raise UserError(f"Unexpected analysis type {analysis_type}")


@router.post(
    "/compute_univariate_associations",
    operation_id="compute_univariate_associations",
    response_model=ComputeResponse,
)
def compute_univariate_associations(
    computeParams: ComputeParams,
    user: str = Depends(get_user),
    settings: Settings = Depends(get_settings),
):
    utils.check_celery()

    resultsDirPrefix = settings.compute_results_location
    dataset_id = computeParams.datasetId
    vector_variable_type = computeParams.vectorVariableType
    depmap_model_ids = computeParams.queryCellLines
    query_values = computeParams.queryValues
    analysis_type = {
        "pearson": models.AnalysisType.pearson,
        "association": models.AnalysisType.association,
        "two_class": models.AnalysisType.two_class,
    }[computeParams.analysisType]

    assert dataset_id is not None
    _validate_parameters(
        analysis_type=analysis_type,
        query_feature_id=computeParams.queryFeatureId,
        query_dataset_id=computeParams.queryDatasetId,
        query_values=query_values,
        depmap_model_ids=depmap_model_ids,
    )

    vector_is_dependent = _get_vector_is_dependent(analysis_type, vector_variable_type)

    results_dir = os.path.join(
        resultsDirPrefix, str(datetime.datetime.now().strftime("%Y%m%d")),
    )

    try:
        result = utils.cast_celery_task(analysis_tasks.run_custom_analysis).delay(
            user=user,
            analysis_type=analysis_type,
            query_feature_id=computeParams.queryFeatureId,
            query_dataset_id=computeParams.queryDatasetId,
            filestore_location=settings.filestore_location,
            dataset_id=dataset_id,
            depmap_model_ids=depmap_model_ids,  # Use might pick subset of cell lines
            query_values=query_values,
            vector_is_dependent=vector_is_dependent,
            results_dir=results_dir,
        )
    except PermissionError as e:
        raise HTTPException(403, detail=str(e))

    return utils.format_task_status(result)


@router.get("/test_task", operation_id="test_task")
def test_task(message):
    utils.check_celery()

    utils.cast_celery_task(analysis_tasks.test_task).delay(message)
