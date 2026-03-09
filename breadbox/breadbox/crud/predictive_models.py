import os
import sqlite3
import uuid
from typing import List, Optional

import pandas as pd
from sqlalchemy import and_
from sqlalchemy.orm import joinedload

from breadbox.config import Settings
from breadbox.crud import dataset as dataset_crud
from breadbox.db.session import SessionWithUser
from breadbox.models.dataset import MatrixDataset
from breadbox.models.predictive_models import (
    PredictiveModelConfig,
    PredictiveModelResult,
)
from breadbox.schemas.custom_http_exception import (
    HTTPException,
    ResourceNotFoundError,
    UserError,
)
from breadbox.schemas.predictive_models import (
    IDAndName,
    ModelConfigOut,
    ModelFit,
    PredictiveFeature,
    PredictiveModelConfigIn,
    PredictiveModelConfigOut,
    PredictiveModelsResponse,
)
from breadbox.service import metadata


def _require_admin(db: SessionWithUser, settings: Settings):
    if db.user not in settings.admin_users:
        raise HTTPException(403, "Admin access required for this operation")


def _delete_result(
    db: SessionWithUser, result: PredictiveModelResult, filestore_location: str
):
    """Delete a PredictiveModelResult and its associated SQLite file."""
    full_path = os.path.join(filestore_location, result.filename)
    if os.path.exists(full_path):
        os.remove(full_path)
    db.delete(result)


def get_all_configs(db: SessionWithUser) -> List[PredictiveModelConfigOut]:
    """Get all predictive model configs grouped by dimension type"""
    configs = (
        db.query(PredictiveModelConfig)
        .order_by(
            PredictiveModelConfig.dimension_type_name, PredictiveModelConfig.index
        )
        .all()
    )

    # Group by dimension type (order is preserved due to ORDER BY)
    grouped: dict[str, List[ModelConfigOut]] = {}
    for config in configs:
        if config.dimension_type_name not in grouped:
            grouped[config.dimension_type_name] = []
        grouped[config.dimension_type_name].append(
            ModelConfigOut(
                id=config.id,
                model_config_name=config.model_config_name,
                model_config_description=config.model_config_description,
            )
        )

    return [
        PredictiveModelConfigOut(dimension_type_name=dim_type, configs=configs_list)
        for dim_type, configs_list in grouped.items()
    ]


def get_configs_for_dimension_type(
    db: SessionWithUser, dimension_type_name: str
) -> Optional[PredictiveModelConfigOut]:
    """Get configs for a specific dimension type"""
    configs = (
        db.query(PredictiveModelConfig)
        .filter(PredictiveModelConfig.dimension_type_name == dimension_type_name)
        .order_by(PredictiveModelConfig.index)
        .all()
    )

    if not configs:
        return None

    return PredictiveModelConfigOut(
        dimension_type_name=dimension_type_name,
        configs=[
            ModelConfigOut(
                id=c.id,
                model_config_name=c.model_config_name,
                model_config_description=c.model_config_description,
            )
            for c in configs
        ],
    )


def _insert_configs(
    db: SessionWithUser, dimension_type_name: str, config_in: PredictiveModelConfigIn,
) -> PredictiveModelConfigOut:
    """Insert config records and return the result."""
    created_configs = []
    for idx, cfg in enumerate(config_in.configs):
        new_config = PredictiveModelConfig(
            dimension_type_name=dimension_type_name,
            model_config_name=cfg.model_config_name,
            model_config_description=cfg.model_config_description,
            index=idx,
        )
        db.add(new_config)
        db.flush()
        created_configs.append(
            ModelConfigOut(
                id=new_config.id,
                model_config_name=new_config.model_config_name,
                model_config_description=new_config.model_config_description,
            )
        )

    return PredictiveModelConfigOut(
        dimension_type_name=dimension_type_name, configs=created_configs
    )


def create_configs(
    db: SessionWithUser,
    settings: Settings,
    dimension_type_name: str,
    config_in: PredictiveModelConfigIn,
) -> PredictiveModelConfigOut:
    """Create configs for a dimension type"""
    _require_admin(db, settings)

    existing = (
        db.query(PredictiveModelConfig)
        .filter(PredictiveModelConfig.dimension_type_name == dimension_type_name)
        .first()
    )
    if existing:
        raise UserError(
            f"Configs already exist for dimension type {dimension_type_name}. Use PATCH to update."
        )

    return _insert_configs(db, dimension_type_name, config_in)


def update_configs(
    db: SessionWithUser,
    settings: Settings,
    dimension_type_name: str,
    config_in: PredictiveModelConfigIn,
) -> PredictiveModelConfigOut:
    """Update configs for a dimension type (replaces all configs)"""
    _require_admin(db, settings)

    db.query(PredictiveModelConfig).filter(
        PredictiveModelConfig.dimension_type_name == dimension_type_name
    ).delete()

    return _insert_configs(db, dimension_type_name, config_in)


def delete_configs(
    db: SessionWithUser,
    settings: Settings,
    dimension_type_name: str,
    filestore_location: str,
):
    """Delete all configs and results for a dimension type"""
    _require_admin(db, settings)

    # Get all results to clean up their files
    results = (
        db.query(PredictiveModelResult)
        .join(PredictiveModelConfig)
        .filter(PredictiveModelConfig.dimension_type_name == dimension_type_name)
        .all()
    )

    for result in results:
        _delete_result(db, result, filestore_location)

    # Delete configs (cascade would delete results, but we already deleted them above)
    deleted = (
        db.query(PredictiveModelConfig)
        .filter(PredictiveModelConfig.dimension_type_name == dimension_type_name)
        .delete()
    )

    if deleted == 0:
        raise ResourceNotFoundError(
            f"No configs found for dimension type {dimension_type_name}"
        )


def _get_config_by_name(
    db: SessionWithUser, dimension_type_name: str, config_name: str
) -> Optional[PredictiveModelConfig]:
    return (
        db.query(PredictiveModelConfig)
        .filter(
            and_(
                PredictiveModelConfig.dimension_type_name == dimension_type_name,
                PredictiveModelConfig.model_config_name == config_name,
            )
        )
        .one_or_none()
    )


def bulk_load_results(
    db: SessionWithUser,
    settings: Settings,
    dimension_type_name: str,
    config_name: str,
    actuals_dataset_id: str,
    predictions_dataset_id: str,
    source_file: str,
):
    """Load results from a parquet file and store as SQLite"""
    _require_admin(db, settings)

    # Get the config
    config = _get_config_by_name(db, dimension_type_name, config_name)
    if config is None:
        raise ResourceNotFoundError(
            f"Config {config_name} not found for dimension type {dimension_type_name}"
        )

    # Verify datasets exist
    actuals_dataset = dataset_crud.get_dataset(db, db.user, actuals_dataset_id)
    if actuals_dataset is None:
        raise ResourceNotFoundError(f"Actuals dataset {actuals_dataset_id} not found")

    predictions_dataset = dataset_crud.get_dataset(db, db.user, predictions_dataset_id)
    if predictions_dataset is None:
        raise ResourceNotFoundError(
            f"Predictions dataset {predictions_dataset_id} not found"
        )

    # Check for existing result
    existing = (
        db.query(PredictiveModelResult)
        .filter(
            and_(
                PredictiveModelResult.config_id == config.id,
                PredictiveModelResult.actuals_dataset_id == actuals_dataset.id,
                PredictiveModelResult.predictions_dataset_id == predictions_dataset.id,
            )
        )
        .one_or_none()
    )

    if existing:
        _delete_result(db, existing, settings.filestore_location)
        db.flush()

    # Read parquet and convert to SQLite
    df = pd.read_parquet(source_file)

    # Create the sqlite file
    dest_filename = f"predictive_models/{uuid.uuid4()}.sqlite3"
    full_dest_path = os.path.join(settings.filestore_location, dest_filename)
    os.makedirs(os.path.dirname(full_dest_path), exist_ok=True)

    _convert_parquet_to_sqlite(df, full_dest_path)

    # Create the result record
    result = PredictiveModelResult(
        config_id=config.id,
        actuals_dataset_id=actuals_dataset.id,
        predictions_dataset_id=predictions_dataset.id,
        filename=dest_filename,
    )
    db.add(result)
    db.flush()

    return result


def _convert_parquet_to_sqlite(df: pd.DataFrame, output_path: str):
    """Convert parquet dataframe to SQLite format"""
    conn = sqlite3.connect(output_path)
    cursor = conn.cursor()

    # Create model_fit table
    cursor.execute(
        """
        CREATE TABLE model_fit (
            actuals_feature_given_id TEXT PRIMARY KEY,
            prediction_actual_correlation REAL NOT NULL
        )
    """
    )

    # Create top_features table
    cursor.execute(
        """
        CREATE TABLE top_features (
            actuals_feature_given_id TEXT NOT NULL,
            rank INTEGER NOT NULL,
            feature_dataset_id TEXT NOT NULL,
            feature_given_id TEXT NOT NULL,
            feature_label TEXT,
            importance REAL NOT NULL,
            correlation_with_actual REAL NOT NULL,
            PRIMARY KEY (actuals_feature_given_id, rank)
        )
    """
    )

    # Insert data
    for _, row in df.iterrows():
        feature_id = row["actuals_feature_given_id"]
        correlation = row["prediction_actual_correlation"]

        cursor.execute(
            "INSERT INTO model_fit (actuals_feature_given_id, prediction_actual_correlation) VALUES (?, ?)",
            (feature_id, correlation),
        )

        # Find all feature columns (feature_1_*, feature_2_*, etc.)
        rank = 1
        while f"feature_{rank}_given_id" in row:
            given_id_col = f"feature_{rank}_given_id"
            dataset_id_col = f"feature_{rank}_dataset_id"
            importance_col = f"feature_{rank}_importance"
            correlation_col = f"feature_{rank}_correlation"
            label_col = f"feature_{rank}_label"

            given_id_val = row.get(given_id_col)
            if given_id_val is None or (
                isinstance(given_id_val, float) and pd.isna(given_id_val)
            ):
                break

            feature_label = row.get(label_col) if label_col in row else None
            # Normalize feature_label to None if it's NaN
            if (
                feature_label is not None
                and isinstance(feature_label, float)
                and pd.isna(feature_label)
            ):
                feature_label = None

            cursor.execute(
                """
                INSERT INTO top_features
                (actuals_feature_given_id, rank, feature_dataset_id, feature_given_id,
                 feature_label, importance, correlation_with_actual)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    feature_id,
                    rank,
                    row[dataset_id_col],
                    row[given_id_col],
                    feature_label,
                    row[importance_col],
                    row[correlation_col],
                ),
            )
            rank += 1

    conn.commit()
    conn.close()


def delete_results(
    db: SessionWithUser,
    settings: Settings,
    dimension_type_name: str,
    config_name: str,
    actuals_dataset_id: str,
):
    """Delete results for a config+dataset combination"""
    _require_admin(db, settings)

    config = _get_config_by_name(db, dimension_type_name, config_name)
    if config is None:
        raise ResourceNotFoundError(
            f"Config {config_name} not found for dimension type {dimension_type_name}"
        )

    # Find all results matching this config and actuals dataset
    results = (
        db.query(PredictiveModelResult)
        .filter(
            and_(
                PredictiveModelResult.config_id == config.id,
                PredictiveModelResult.actuals_dataset_id == actuals_dataset_id,
            )
        )
        .all()
    )

    if not results:
        raise ResourceNotFoundError(
            f"No results found for config {config_name} and dataset {actuals_dataset_id}"
        )

    for result in results:
        _delete_result(db, result, settings.filestore_location)


def get_predictive_models_for_feature(
    db: SessionWithUser, settings: Settings, dataset_id: str, feature_given_id: str,
) -> Optional[PredictiveModelsResponse]:
    """Get predictive model results for a specific feature"""
    # Get the dataset
    dataset = dataset_crud.get_dataset(db, db.user, dataset_id)
    if dataset is None:
        return None

    if not isinstance(dataset, MatrixDataset):
        raise UserError(f"Dataset {dataset_id} is not a matrix dataset")

    # Get the feature type to find configs
    feature_type_name = dataset.feature_type_name
    if feature_type_name is None:
        return None

    # Get feature label
    labels_by_id = metadata.get_matrix_dataset_feature_labels_by_id(
        db, db.user, dataset
    )
    feature_label = labels_by_id.get(feature_given_id, feature_given_id)

    # Find all results for this dataset
    results = (
        db.query(PredictiveModelResult)
        .join(PredictiveModelConfig)
        .filter(
            and_(
                PredictiveModelResult.actuals_dataset_id == dataset.id,
                PredictiveModelConfig.dimension_type_name == feature_type_name,
            )
        )
        .options(
            joinedload(PredictiveModelResult.config),
            joinedload(PredictiveModelResult.predictions_dataset),
        )
        .all()
    )

    if not results:
        return PredictiveModelsResponse(
            actuals_dataset=IDAndName(id=dataset.id, name=dataset.name),
            actuals_feature_given_id=feature_given_id,
            actuals_feature_label=feature_label,
            model_fits=[],
        )

    model_fits = []
    for result in results:
        sqlite_path = os.path.join(settings.filestore_location, result.filename)

        if not os.path.exists(sqlite_path):
            continue

        model_fit_data = _read_model_fit_from_sqlite(sqlite_path, feature_given_id)
        if model_fit_data is None:
            continue

        correlation, top_features = model_fit_data

        model_fits.append(
            ModelFit(
                predictions_dataset=IDAndName(
                    id=result.predictions_dataset.id,
                    name=result.predictions_dataset.name,
                ),
                config_name=result.config.model_config_name,
                config_description=result.config.model_config_description,
                prediction_actual_correlation=correlation,
                top_features=top_features,
            )
        )

    return PredictiveModelsResponse(
        actuals_dataset=IDAndName(id=dataset.id, name=dataset.name),
        actuals_feature_given_id=feature_given_id,
        actuals_feature_label=feature_label,
        model_fits=model_fits,
    )


def _read_model_fit_from_sqlite(
    sqlite_path: str, feature_given_id: str
) -> Optional[tuple[float, List[PredictiveFeature]]]:
    """Read model fit data from SQLite file"""
    conn = sqlite3.connect(sqlite_path)
    cursor = conn.cursor()

    # Get correlation
    cursor.execute(
        "SELECT prediction_actual_correlation FROM model_fit WHERE actuals_feature_given_id = ?",
        (feature_given_id,),
    )
    row = cursor.fetchone()
    if row is None:
        conn.close()
        return None

    correlation = row[0]

    # Get top features
    cursor.execute(
        """
        SELECT rank, feature_dataset_id, feature_given_id, feature_label,
               importance, correlation_with_actual
        FROM top_features
        WHERE actuals_feature_given_id = ?
        ORDER BY rank
    """,
        (feature_given_id,),
    )

    top_features = []
    for row in cursor.fetchall():
        top_features.append(
            PredictiveFeature(
                rank=row[0],
                feature_dataset_id=row[1],
                feature_given_id=row[2],
                feature_label=row[3],
                importance=row[4],
                correlation_with_actual=row[5],
            )
        )

    conn.close()
    return correlation, top_features
