from pydantic import BaseModel
from typing import Annotated, Optional

from breadbox.api.dependencies import get_db_with_user
from breadbox.crud import dataset as dataset_crud
from breadbox.schemas.custom_http_exception import (
    DatasetNotFoundError,
    ResourceNotFoundError,
    UserError,
)
from breadbox.config import get_settings, Settings
from breadbox.db.session import SessionWithUser
import pandas as pd
import json
import hashlib
from breadbox.models.dataset import (
    Dataset as DatasetModel,
    ValueType,
    MatrixDataset,
    TabularDataset,
)
from breadbox.service import dataset as dataset_service
from breadbox.schemas.parquet_export import (
    MatrixSubsetOperation,
    TabularSubsetOperation,
)
from breadbox.schemas.dataset import MatrixDimensionsInfo, FeatureSampleIdentifier

from typing import Any, Callable, Awaitable
from .tempspace import Tempspace

from fastapi.responses import JSONResponse
import logging
import os
import tempfile
from breadbox.api.datasets import _get_required_tabular_dataset, TabularDimensionsInfo


def get_tabular_df(
    db: SessionWithUser, tabular_dataset: TabularDataset
) -> pd.DataFrame:
    tabular_dimensions_info = TabularDimensionsInfo()
    df = dataset_service.get_subsetted_tabular_dataset_df(
        db, db.user, tabular_dataset, tabular_dimensions_info, False
    )
    return df


def canonical_sha(key_dict: dict) -> str:
    return hashlib.sha256(
        json.dumps(key_dict, sort_keys=True).encode("utf8")
    ).hexdigest()


def _get_required_matrix_dataset(db: SessionWithUser, dataset_id: str) -> MatrixDataset:
    dataset = dataset_crud.get_dataset(db, db.user, dataset_id)
    if dataset is None:
        raise DatasetNotFoundError(f"Could not find dataset with id {dataset_id}")
    if not isinstance(dataset, MatrixDataset):
        raise UserError(f"This endpoint only works with MatrixDatasets")
    return dataset


def get_matrix_df(
    db: SessionWithUser,
    filestore_location: str,
    dataset: MatrixDataset,
    feature_ids: Optional[list[str]],
    sample_ids: Optional[list[str]],
) -> pd.DataFrame:

    if sample_ids is None and feature_ids is None:
        raise UserError("Must specify either features_ids or sample_ids to export")

    if sample_ids is not None and feature_ids is not None:
        # The rational is that this will yield tiny exports and not worth implementing support for. The later sql query can always do the necessary
        # filtering.
        raise UserError(
            "Must specify either features_ids or sample_ids to export. Specifying both is not supported"
        )

    matrix_dimensions_info = MatrixDimensionsInfo(
        features=feature_ids,
        feature_identifier=FeatureSampleIdentifier.id
        if feature_ids is not None
        else None,
        samples=sample_ids,
        sample_identifier=FeatureSampleIdentifier.id
        if sample_ids is not None
        else None,
    )

    df = dataset_service.get_subsetted_matrix_dataset_df(
        db, dataset, matrix_dimensions_info, filestore_location, strict=False,
    )

    return df


def materialize_tabular(
    db: SessionWithUser, op: TabularSubsetOperation, tempspace: Tempspace
):
    dataset = _get_required_tabular_dataset(db, op.dataset_id)

    key = canonical_sha({"type": "materialize_matrix", "dataset_id": dataset.id})
    dest_path, exists = tempspace.get_path_if_exists(key)

    if not exists:
        df = get_tabular_df(db, dataset)

        with tempfile.NamedTemporaryFile() as tmp:
            df.to_parquet(tmp.name)
            tempspace.put(tmp.name, dest_path)

    return tempspace.abspath(dest_path)


def materialize_matrix(
    db: SessionWithUser,
    filestore_location: str,
    op: MatrixSubsetOperation,
    tempspace: Tempspace,
):
    dataset = _get_required_matrix_dataset(db, op.dataset_id)

    key = canonical_sha(
        {
            "type": "materialize_matrix",
            "dataset_id": dataset.id,
            "feature_ids": op.feature_ids,
            "sample_ids": op.sample_ids,
        }
    )
    dest_path, exists = tempspace.get_path_if_exists(key)

    if not exists:
        df = get_matrix_df(
            db, filestore_location, dataset, op.feature_ids, op.sample_ids
        )
        df = (
            df.rename_axis("sample_id")
            .reset_index()
            .melt(id_vars="sample_id", var_name="feature_id", value_name="value")
        )

        with tempfile.NamedTemporaryFile() as tmp:
            df.to_parquet(tmp.name)
            tempspace.put(tmp.name, dest_path)

    return tempspace.abspath(dest_path)
