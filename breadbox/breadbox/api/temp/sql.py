from itsdangerous import BadSignature
from pydantic import BaseModel
from typing import Annotated, Optional

from .router import router
from fastapi import APIRouter, Body, Depends, HTTPException, Request, Header
from breadbox.api.dependencies import get_db_with_user, get_cas_db_path
from breadbox.crud import dataset as dataset_crud
from breadbox.schemas.custom_http_exception import ResourceNotFoundError
from ...config import get_settings, Settings
from ...db.session import SessionWithUser
from ...service.sql import generate_simulated_schema, execute_sql_in_virtual_db
from fastapi.responses import PlainTextResponse, StreamingResponse
from breadbox.io import cas
from itsdangerous.url_safe import URLSafeSerializer
from ..uploads import get_itsdangerous_serializer


class StreamingCSVResponse(StreamingResponse):
    media_type = "text/csv"


class SqlQuery(BaseModel):
    filename: Optional[str] = None
    sql: str


class QueryByKey(BaseModel):
    filename: Optional[str]
    key: str


class QueryURL(BaseModel):
    url: str


def _validate_allowed(settings: Settings, x_proof_of_privilege: Optional[str]):
    if not (
        settings.sql_endpoints_enabled
        or (
            settings.privileged_key is not None
            and settings.privileged_key == x_proof_of_privilege
        )
    ):
        raise HTTPException(403, "SQL endpoints not enabled in this environment")


def _execute_query(
    sql: str, db: SessionWithUser, settings: Settings, filename: Optional[str] = None
):
    content = execute_sql_in_virtual_db(db, settings.filestore_location, sql)
    headers = {}
    if filename is not None:
        headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    return StreamingCSVResponse(content, headers=headers)


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

    if dataset_given_id is None:
        dataset = None
    else:
        dataset = dataset_crud.get_dataset(db, db.user, dataset_id=dataset_given_id)
        if dataset is None:
            raise ResourceNotFoundError("Dataset not found")

    statements_by_given_id = generate_simulated_schema(db, dataset)
    return statements_by_given_id


@router.post(
    "/sql/create-signed-query", operation_id="create_query_url", response_model=QueryURL
)
def create_query_url(
    query: SqlQuery,
    request: Request,
    cas_db_path: Annotated[str, Depends(get_cas_db_path)],
    serializer: Annotated[URLSafeSerializer, Depends(get_itsdangerous_serializer)],
    settings: Annotated[Settings, Depends(get_settings)],
    x_proof_of_privilege: Annotated[Optional[str], Header()] = None,
):
    """
    Return a URL which can be used to execute a SQL query, without requiring any addition authentication
    """
    _validate_allowed(settings, x_proof_of_privilege)

    key = cas.set_value(cas_db_path, query.sql)
    signed_query = serializer.dumps(
        QueryByKey(key=key, filename=query.filename).model_dump()
    )
    base_url = request.url_for("query_sql_by_key")
    return QueryURL(url=f"{base_url}?query={signed_query}")


@router.get("/sql/query", operation_id="query_sql", response_class=StreamingCSVResponse)
def query_sql_by_key(
    query: str,
    db: Annotated[SessionWithUser, Depends(get_db_with_user)],
    cas_db_path: Annotated[str, Depends(get_cas_db_path)],
    serializer: Annotated[URLSafeSerializer, Depends(get_itsdangerous_serializer)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    # no check for settings.sql_endpoints_enabled or other auth check because key is signed
    # and if it has a valid signature, we'll trust it
    try:
        trusted_dict = serializer.loads(query)
    except BadSignature:
        raise HTTPException(403, "Invalid key")

    decoded_query = QueryByKey(**trusted_dict)

    sql = cas.get_value(cas_db_path, decoded_query.key)
    if sql is None:
        raise HTTPException(404, "SQL query not found")
    return _execute_query(sql, db, settings, decoded_query.filename)


@router.post(
    "/sql/query", operation_id="query_sql", response_class=StreamingCSVResponse
)
def query_sql(
    query: SqlQuery,
    db: SessionWithUser = Depends(get_db_with_user),
    settings: Settings = Depends(get_settings),
    x_proof_of_privilege: Annotated[Optional[str], Header()] = None,
):
    _validate_allowed(settings, x_proof_of_privilege)
    if not (
        settings.sql_endpoints_enabled
        or (
            settings.privileged_key is not None
            and settings.privileged_key == x_proof_of_privilege
        )
    ):
        raise HTTPException(403, "SQL endpoints not enabled in this environment")

    return _execute_query(query.sql, db, settings)
