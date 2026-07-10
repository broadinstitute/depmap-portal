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


from typing import Any, Callable, Awaitable

from fastapi.responses import JSONResponse
import logging
import os
import tempfile
import argparse


log = logging.getLogger(__name__)


class Sql2Query(BaseModel):
    tabular_data: list[TabularSubsetOperation]
    matrix_data: list[MatrixSubsetOperation]
    sql: str


def materialize_tables(
    db: SessionWithUser,
    filestore_location: str,
    root_path: str,
    tabular_data: list[TabularSubsetOperation],
    matrix_data: list[MatrixSubsetOperation],
) -> dict[str, str]:
    result = {}

    for x in tabular_data:
        result[x.destination] = materialize_tabular(db, root_path, x)

    for x in matrix_data:
        result[x.destination] = materialize_matrix(db, filestore_location, root_path, x)

    return result


def write_duckdb_sql(
    db: SessionWithUser,
    settings: Settings,
    root_path,
    query: Sql2Query,
    script_dest: str,
):
    name_mapping = materialize_tables(
        db,
        settings.filestore_location,
        root_path,
        query.tabular_data,
        query.matrix_data,
    )

    with open(script_dest, "wt") as fd:
        # Create a view for each file we've materialized
        for name, parquet_path in name_mapping.items():
            fd.write(
                f"CREATE VIEW {name} as SELECT * FROM read_parquet('{parquet_path}');\n"
            )

        # and now run the query
        fd.write(query.sql + ";\n")
