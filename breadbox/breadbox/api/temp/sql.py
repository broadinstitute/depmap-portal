from pydantic import BaseModel

from .router import router
from fastapi import APIRouter, Body, Depends, HTTPException
from breadbox.api.dependencies import get_db_with_user
from ...db.session import SessionWithUser
from ...service.sql import generate_simulated_schema, execute_sql_in_virtual_db
from fastapi.responses import PlainTextResponse, StreamingResponse


class SqlQuery(BaseModel):
    sql: str


@router.get(
    "/sql/schema", operation_id="get_sql_schema", response_class=PlainTextResponse
)
def get_sql_schema(db: SessionWithUser = Depends(get_db_with_user),):
    schema_text = generate_simulated_schema(db)
    return schema_text


@router.post("/sql/query", operation_id="query_sql")
def get_sql_schema(
    query: SqlQuery, db: SessionWithUser = Depends(get_db_with_user),
):
    import apsw.ext
    import sys

    try:
        streaming_result = execute_sql_in_virtual_db(db, query.sql)
        return StreamingResponse(streaming_result, media_type="text/csv")
    except Exception as exc:
        apsw.ext.print_augmented_traceback(*sys.exc_info())
