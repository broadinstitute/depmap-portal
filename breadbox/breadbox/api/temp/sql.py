from .router import router
from fastapi import APIRouter, Body, Depends, HTTPException
from breadbox.api.dependencies import get_db_with_user
from ...db.session import SessionWithUser
from ...service.sql import generate_simulated_schema
from fastapi.responses import PlainTextResponse


@router.get(
    "/sql/schema", operation_id="get_sql_schema", response_class=PlainTextResponse
)
def get_sql_schema(db: SessionWithUser = Depends(get_db_with_user),):
    schema_text = generate_simulated_schema(db)
    return schema_text
