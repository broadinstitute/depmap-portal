# from celery.worker.control import time_limit
from pydantic import BaseModel
from typing import Annotated, Optional

# from .router import router
# from fastapi import APIRouter, Body, Depends, HTTPException
from breadbox.api.dependencies import get_db_with_user
from breadbox.crud import dataset as dataset_crud
from breadbox.schemas.custom_http_exception import ResourceNotFoundError, UserError
from breadbox.config import get_settings, Settings
from breadbox.db.session import SessionWithUser

# from breadbox.service.sql import generate_simulated_schema, execute_sql_in_virtual_db
# from fastapi.responses import PlainTextResponse, FileResponse, Response
# from breadbox.celery_task import utils
# import asyncio
# from breadbox.compute.sql import execute_sql_in_virtual_db_task
# from celery.exceptions import TimeLimitExceeded

import anyio.to_thread
from typing import Any, Callable, Awaitable

from fastapi.responses import JSONResponse
import logging
import os
import tempfile
import argparse

# import duckdb
import io

log = logging.getLogger(__name__)
# from .sql import CSVFileResponse


class MatrixSubsetOperation(BaseModel):
    dataset_id: str
    destination: str
    feature_ids: Optional[list[str]]
    sample_ids: Optional[list[str]]


class TabularSubsetOperation(BaseModel):
    dataset_id: str
    destination: str


class Sql2Query(BaseModel):
    tabular_data: list[TabularSubsetOperation]
    matrix_data: list[MatrixSubsetOperation]
    sql: str


def get_materialized_path():
    path = os.path.join(tempfile.gettempdir(), "mat-proto")
    os.makedirs(path, exist_ok=True)
    return path


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


def canonical_sha(model: BaseModel) -> str:
    return hashlib.sha256(
        json.dumps(model.model_dump(), sort_keys=True).encode("utf8")
    ).hexdigest()


def get_parquet_path(root_path: str, op: BaseModel):
    key = canonical_sha(op)
    return os.path.join(root_path, key)


from breadbox.api.datasets import _get_required_tabular_dataset, TabularDimensionsInfo


def get_tabular_df(db: SessionWithUser, dataset_id: str) -> pd.DataFrame:
    tabular_dataset = _get_required_tabular_dataset(db, dataset_id)
    tabular_dimensions_info = TabularDimensionsInfo()
    df = dataset_service.get_subsetted_tabular_dataset_df(
        db, db.user, tabular_dataset, tabular_dimensions_info, False
    )
    return df


def get_matrix_df(
    db: SessionWithUser,
    filestore_location: str,
    dataset_id: str,
    feature_ids: Optional[list[str]],
    sample_ids: Optional[list[str]],
) -> pd.DataFrame:

    if sample_ids is not None:
        assert feature_ids is None
        raise NotImplementedError()
        # sample_indices = []
        # assert feature_ids is not None
        # dataset = None
        # for i in range(len(sample_indices)):
        #     feature = (
        #         db=db, dataset_id=dataset_id, feature_given_id=feature_ids[i]
        #     )
        #     dataset = feature.dataset
        #     if not isinstance(dataset, MatrixDataset):
        #         raise UserError(
        #             f"Expected a matrix dataset. Unable to load feature data for tabular dataset: '{feature.dataset_id}' "
        #         )
        #     assert feature.index is not None
        #     feature_indices.append(feature.index)

        # # Read data from the HDF5 file
        # assert dataset is not None
        # df = get_feature_slice(dataset, feature_indices, filestore_location)
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


def atomic_parquet_write(df: pd.DataFrame, dest: str):
    fd, fn = tempfile.mkstemp(dir=os.path.dirname(dest))
    df.to_parquet(fn)
    os.rename(fn, dest)
    os.close(fd)


def materialize_tabular(
    db: SessionWithUser, root_path: str, op: TabularSubsetOperation
):
    dest = get_parquet_path(root_path, op)
    if os.path.exists(dest):
        return dest

    # we need to create it (do atomicly)
    df = get_tabular_df(db, op.dataset_id)
    atomic_parquet_write(df, dest)

    return dest


def materialize_matrix(
    db: SessionWithUser,
    filestore_location: str,
    root_path: str,
    op: MatrixSubsetOperation,
):
    dest = get_parquet_path(root_path, op)
    if os.path.exists(dest):
        return dest

    # we need to create it (do atomicly)
    df = get_matrix_df(
        db, filestore_location, op.dataset_id, op.feature_ids, op.sample_ids
    )
    df = (
        df.rename_axis("sample_id")
        .reset_index()
        .melt(id_vars="sample_id", var_name="feature_id", value_name="value")
    )
    atomic_parquet_write(df, dest)

    return dest


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


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root-path", default="./materialized")
    parser.add_argument("--query-json", required=True)
    args = parser.parse_args()

    with open(args.query_json, "rt") as fd:
        query = Sql2Query.model_validate_json(fd.read())

    return args.root_path, query


import time


def main():
    root_path, query = parse_args()

    script_dest = "scratch.sql"

    db = SessionLocalWithUser("nobody")
    settings = get_settings()
    os.makedirs(root_path, exist_ok=True)
    start = time.time()
    write_duckdb_sql(db, settings, root_path, query, script_dest)
    end = time.time()
    db.close()
    print(f"staging took {end-start} seconds")

    start = time.time()
    os.system(f"duckdb < {script_dest}")
    end = time.time()
    print(f"query took {end-start} seconds")


from breadbox.db.session import SessionLocalWithUser, SessionWithUser
from breadbox.config import Settings, get_settings
import os

if __name__ == "__main__":
    main()


# def execute_query(db: SessionWithUser, settings: Settings, root_path, query: Sql2Query) -> pd.DataFrame:
#     name_mapping = materialize_tables(db, settings.filestore_location, root_path, query.tabular_data, query.matrix_data)

#     # Create an explicit in-memory database connection
#     con = duckdb.connect(database=":memory:")

#     # Create a view for each file we've materialized
#     for name, parquet_path in name_mapping.items():
#         con.execute(f"CREATE VIEW {name} as SELECT * FROM read_parquet('{parquet_path}');")

#     # and now run the query
#     df = con.sql(query.sql)

#     return df

# @router.post("/sql2/query", operation_id="query_sql2", response_class=CSVFileResponse)
# async def query_sql2(
#     query: Sql2Query,
#     db: SessionWithUser = Depends(get_db_with_user),
#     settings: Settings = Depends(get_settings),
# ):
#     df = execute_query(db, settings, get_materialized_path(), query)
#     buf = io.StringIO()
#     df.to_csv(buf)
#     return buf.getvalue()
