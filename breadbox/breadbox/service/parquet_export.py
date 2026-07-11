from pydantic import BaseModel
from typing import Annotated, Optional

from breadbox.api.dependencies import get_db_with_user
from breadbox.crud import dataset as dataset_crud
from breadbox.schemas.custom_http_exception import ResourceNotFoundError, UserError
from breadbox.config import get_settings, Settings
from breadbox.db.session import SessionWithUser
import pandas as pd
import json
import hashlib
from breadbox.crud.dimension_ids import get_dataset_feature_by_given_id
from breadbox.models.dataset import (
    Dataset as DatasetModel,
    ValueType,
    MatrixDataset,
    TabularDataset,
)
from breadbox.io.filestore_crud import get_feature_slice
from breadbox.service import dataset as dataset_service
from breadbox.schemas.parquet_export import (
    MatrixSubsetOperation,
    TabularSubsetOperation,
)

from typing import Any, Callable, Awaitable
from .tempspace import Tempspace

from fastapi.responses import JSONResponse
import logging
import os
import tempfile
from breadbox.api.datasets import _get_required_tabular_dataset, TabularDimensionsInfo
from breadbox.schemas.custom_http_exception import UserError


def get_tabular_df(db: SessionWithUser, dataset_id: str) -> pd.DataFrame:
    tabular_dataset = _get_required_tabular_dataset(db, dataset_id)
    tabular_dimensions_info = TabularDimensionsInfo()
    df = dataset_service.get_subsetted_tabular_dataset_df(
        db, db.user, tabular_dataset, tabular_dimensions_info, False
    )
    return df


def canonical_sha(model: BaseModel) -> str:
    return hashlib.sha256(
        json.dumps(model.model_dump(), sort_keys=True).encode("utf8")
    ).hexdigest()


def get_matrix_df(
    db: SessionWithUser,
    filestore_location: str,
    dataset_id: str,
    feature_ids: Optional[list[str]],
    sample_ids: Optional[list[str]],
) -> pd.DataFrame:

    if sample_ids is None and feature_ids is None:
        raise UserError("Must specify either features_ids or sample_ids to export")

    if sample_ids is not None:
        if feature_ids is not None:
            # The rational is that this will yield tiny exports and not worth implementing support for. The later sql query can always do the necessary
            # filtering.
            raise UserError(
                "Must specify either features_ids or sample_ids to export. Specifying both is not supported"
            )

        # TODO: Implement
        raise NotImplementedError()
    else:
        feature_indices = []
        assert feature_ids is not None
        dataset = None
        for i in range(len(feature_ids)):
            feature = get_dataset_feature_by_given_id(
                db=db, dataset_id=dataset_id, feature_given_id=feature_ids[i]
            )
            dataset = feature.dataset
            if not isinstance(dataset, MatrixDataset):
                raise UserError(
                    f"Expected a matrix dataset. Unable to load feature data for tabular dataset: '{feature.dataset_id}' "
                )
            assert feature.index is not None
            feature_indices.append(feature.index)

        # Read data from the HDF5 file
        assert dataset is not None
        df = get_feature_slice(dataset, feature_indices, filestore_location)

    return df


def materialize_tabular(
    db: SessionWithUser, op: TabularSubsetOperation, tempspace: Tempspace
):
    key = canonical_sha(op)
    dest_path, exists = tempspace.get_path_if_exists(key)

    if not exists:
        df = get_tabular_df(db, op.dataset_id)

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
    key = canonical_sha(op)
    dest_path, exists = tempspace.get_path_if_exists(key)

    if not exists:
        df = get_matrix_df(
            db, filestore_location, op.dataset_id, op.feature_ids, op.sample_ids
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
