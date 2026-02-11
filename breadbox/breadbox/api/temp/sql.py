from pydantic import BaseModel
from typing import Annotated, Optional

from .router import router
from fastapi import APIRouter, Body, Depends, HTTPException
from breadbox.api.dependencies import get_db_with_user
from breadbox.crud import dataset as dataset_crud
from ...config import get_settings, Settings
from ...db.session import SessionWithUser
from ...service.sql import generate_simulated_schema, execute_sql_in_virtual_db
from fastapi.responses import PlainTextResponse, StreamingResponse


class StreamingCSVResponse(StreamingResponse):
    media_type = "text/csv"


class SqlQuery(BaseModel):
    sql: str


@router.get(
    "/sql/schema", operation_id="get_sql_schema",
)
def get_sql_schema(
    db: SessionWithUser = Depends(get_db_with_user),
    settings: Settings = Depends(get_settings),
    dataset_given_id: Optional[str] = None,
):
    """
    Return a virtual schema definition queryable by the /sql/query endpoint.
    If a dataset given ID is specified, only return a subset of the schema definition 
    (tables relevant to that dataset).
    """
    if not settings.sql_endpoints_enabled:
        raise HTTPException(403, "SQL endpoints not enabled in this environment")

    dataset = dataset_crud.get_dataset(db, db.user, dataset_id=dataset_given_id)
    statements_by_given_id = generate_simulated_schema(db, dataset)
    return statements_by_given_id


@router.post(
    "/sql/query", operation_id="query_sql", response_class=StreamingCSVResponse
)
def query_sql(
    query: SqlQuery,
    db: SessionWithUser = Depends(get_db_with_user),
    settings: Settings = Depends(get_settings),
):
    if not settings.sql_endpoints_enabled:
        raise HTTPException(403, "SQL endpoints not enabled in this environment")

    streaming_result = execute_sql_in_virtual_db(
        db, settings.filestore_location, query.sql
    )
    return streaming_result
