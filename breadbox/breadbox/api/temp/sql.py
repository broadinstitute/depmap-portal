from pydantic import BaseModel

from .router import router
from fastapi import APIRouter, Body, Depends, HTTPException
from breadbox.api.dependencies import get_db_with_user
from ...config import get_settings, Settings
from ...db.session import SessionWithUser
from ...service.sql import generate_simulated_schema, execute_sql_in_virtual_db
from fastapi.responses import PlainTextResponse, StreamingResponse


class SqlQuery(BaseModel):
    sql: str


@router.get(
    "/sql/schema", operation_id="get_sql_schema", response_class=PlainTextResponse
)
def get_sql_schema(
    db: SessionWithUser = Depends(get_db_with_user),
    settings: Settings = Depends(get_settings),
):
    if not settings.sql_endpoints_enabled:
        raise HTTPException(403, "SQL endpoints not enabled in this environment")

    schema_text = generate_simulated_schema(db)
    return schema_text


@router.post("/sql/query", operation_id="query_sql")
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
    return StreamingResponse(streaming_result, media_type="text/csv")
