import os
from typing import Annotated, List

from fastapi import Body, Depends
from itsdangerous import URLSafeSerializer

from breadbox.api.dependencies import get_db_with_user
from breadbox.api.uploads import construct_file_from_ids
from breadbox.config import Settings, get_settings
from breadbox.crud import predictive_models as predictive_models_crud
from breadbox.db.session import SessionWithUser
from breadbox.db.util import transaction
from breadbox.schemas.custom_http_exception import ResourceNotFoundError
from breadbox.schemas.predictive_models import (
    BulkLoadResultsIn,
    PredictiveModelConfigIn,
    PredictiveModelConfigOut,
    PredictiveModelsResponse,
)

from .router import router


@router.get(
    "/predictive_models/feature/{dataset_id}/{feature_given_id}",
    operation_id="get_predictive_models_for_feature",
    response_model=PredictiveModelsResponse,
)
def get_predictive_models_for_feature(
    dataset_id: str,
    feature_given_id: str,
    db: Annotated[SessionWithUser, Depends(get_db_with_user)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    """Get predictive model results for a specific feature in a dataset"""
    result = predictive_models_crud.get_predictive_models_for_feature(
        db, settings, dataset_id, feature_given_id
    )
    if result is None:
        raise ResourceNotFoundError(
            f"Dataset {dataset_id} not found or has no predictive models"
        )
    return result


@router.get(
    "/predictive_models/configs/{dimension_type_name}",
    operation_id="get_predictive_model_configs_for_dimension_type",
    response_model=PredictiveModelConfigOut,
)
def get_predictive_model_configs_for_dimension_type(
    dimension_type_name: str, db: Annotated[SessionWithUser, Depends(get_db_with_user)],
):
    """Get predictive model configs for a specific dimension type"""
    result = predictive_models_crud.get_configs_for_dimension_type(
        db, dimension_type_name
    )
    if result is None:
        raise ResourceNotFoundError(
            f"No configs found for dimension type {dimension_type_name}"
        )
    return result


@router.get(
    "/predictive_models/configs",
    operation_id="get_all_predictive_model_configs",
    response_model=List[PredictiveModelConfigOut],
)
def get_all_predictive_model_configs(
    db: Annotated[SessionWithUser, Depends(get_db_with_user)],
):
    """Get all predictive model configs"""
    return predictive_models_crud.get_all_configs(db)


@router.post(
    "/predictive_models/configs/{dimension_type_name}",
    operation_id="create_predictive_model_configs",
    response_model=PredictiveModelConfigOut,
)
def create_predictive_model_configs(
    dimension_type_name: str,
    db: Annotated[SessionWithUser, Depends(get_db_with_user)],
    settings: Annotated[Settings, Depends(get_settings)],
    config_in: Annotated[
        PredictiveModelConfigIn,
        Body(description="The configs to create for this dimension type"),
    ],
):
    """Create predictive model configs for a dimension type (admin only)"""
    with transaction(db):
        return predictive_models_crud.create_configs(
            db, settings, dimension_type_name, config_in
        )


@router.patch(
    "/predictive_models/configs/{dimension_type_name}",
    operation_id="update_predictive_model_configs",
    response_model=PredictiveModelConfigOut,
)
def update_predictive_model_configs(
    dimension_type_name: str,
    db: Annotated[SessionWithUser, Depends(get_db_with_user)],
    settings: Annotated[Settings, Depends(get_settings)],
    config_in: Annotated[
        PredictiveModelConfigIn,
        Body(description="The configs to replace existing configs with"),
    ],
):
    """Update predictive model configs for a dimension type (admin only)"""
    with transaction(db):
        return predictive_models_crud.update_configs(
            db, settings, dimension_type_name, config_in
        )


@router.delete(
    "/predictive_models/configs/{dimension_type_name}",
    operation_id="delete_predictive_model_configs",
)
def delete_predictive_model_configs(
    dimension_type_name: str,
    db: Annotated[SessionWithUser, Depends(get_db_with_user)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    """Delete all predictive model configs for a dimension type (admin only)"""
    with transaction(db):
        predictive_models_crud.delete_configs(
            db, settings, dimension_type_name, settings.filestore_location
        )
    return {"status": "deleted"}


@router.post(
    "/predictive_models/config/{dimension_type_name}/{config_name}/{dataset_id}",
    operation_id="bulk_load_predictive_model_results",
)
def bulk_load_predictive_model_results(
    dimension_type_name: str,
    config_name: str,
    dataset_id: str,
    db: Annotated[SessionWithUser, Depends(get_db_with_user)],
    settings: Annotated[Settings, Depends(get_settings)],
    results_in: Annotated[
        BulkLoadResultsIn,
        Body(description="File IDs and MD5 for the parquet file with results"),
    ],
):
    """Bulk load predictive model results from a parquet file (admin only)"""
    serializer = URLSafeSerializer(settings.breadbox_secret)

    full_file = construct_file_from_ids(
        results_in.file_ids,
        results_in.md5,
        serializer,
        settings.compute_results_location,
    )

    try:
        with transaction(db):
            result = predictive_models_crud.bulk_load_results(
                db,
                settings,
                dimension_type_name,
                config_name,
                dataset_id,
                results_in.predictions_dataset_id,
                full_file,
            )
            return {
                "status": "loaded",
                "result_id": result.id,
            }
    finally:
        # Clean up the temp file
        if os.path.exists(full_file):
            os.remove(full_file)


@router.delete(
    "/predictive_models/config/{dimension_type_name}/{config_name}/{dataset_id}",
    operation_id="delete_predictive_model_results",
)
def delete_predictive_model_results(
    dimension_type_name: str,
    config_name: str,
    dataset_id: str,
    db: Annotated[SessionWithUser, Depends(get_db_with_user)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    """Delete predictive model results for a config+dataset combination (admin only)"""
    with transaction(db):
        predictive_models_crud.delete_results(
            db, settings, dimension_type_name, config_name, dataset_id
        )
    return {"status": "deleted"}
