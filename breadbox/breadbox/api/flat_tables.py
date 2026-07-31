from typing import List

from fastapi import APIRouter, Depends, status
from fastapi.encoders import jsonable_encoder

from breadbox.celery_task import utils as celery_utils
from breadbox.compute.flat_table_tasks import run_flat_table_upload
from breadbox.crud import flat_table as flat_table_crud
from breadbox.db.session import SessionWithUser
from breadbox.db.util import transaction
from breadbox.schemas.custom_http_exception import HTTPException, ResourceNotFoundError
from breadbox.schemas.dataset import AddDatasetResponse
from breadbox.schemas.flat_table import (
    FlatTableCreateParams,
    FlatTableResponse,
    FlatTableSubsetRequest,
    FlatTableSubsetResponse,
    FlatTableSummaryResponse,
    FlatTableUpdateParams,
)
from breadbox.service import flat_table as flat_table_service

from ..config import Settings, get_settings
from .dependencies import get_db_with_user

router = APIRouter(tags=["flat_tables"])


def _assert_is_admin(db: SessionWithUser, settings: Settings):
    if db.user not in settings.admin_users:
        raise HTTPException(403, "Admin access required for this operation")


def _get_required_flat_table(db: SessionWithUser, flat_table_id: str):
    flat_table = flat_table_crud.get_flat_table(db, flat_table_id)
    if flat_table is None:
        raise ResourceNotFoundError(
            f"Could not find flat table with id {flat_table_id}"
        )
    return flat_table


@router.post(
    "/flattable",
    operation_id="add_flat_table",
    response_model=AddDatasetResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def add_flat_table(
    flat_table: FlatTableCreateParams,
    db: SessionWithUser = Depends(get_db_with_user),
    settings: Settings = Depends(get_settings),
):
    """
    Create a new flat table.

    Ingestion (parsing the uploaded parquet file, loading it into a per-table SQLite file, and
    building any requested indices) happens asynchronously via a Celery task, mirroring the
    dataset upload flow. No FlatTable record is created until the task succeeds -- poll
    `GET /api/task/{id}` with the returned `id` until `state` is `SUCCESS` or `FAILURE`.
    """
    _assert_is_admin(db, settings)

    flat_table_json = jsonable_encoder(flat_table)
    result = run_flat_table_upload.delay(flat_table_json, db.user)  # pyright: ignore

    return celery_utils.format_task_status(result)


@router.get(
    "/flattable/{id}",
    operation_id="get_flat_table",
    response_model=FlatTableResponse,
    response_model_by_alias=False,
    response_model_exclude_none=False,
)
def get_flat_table(id: str, db: SessionWithUser = Depends(get_db_with_user)):
    """
    Retrieve metadata about a flat table. `id` can be either the `flat_table_id` or a
    given_id, which always resolves to the current version.
    """
    flat_table = _get_required_flat_table(db, id)
    return flat_table_service.to_flat_table_response(flat_table)


@router.get(
    "/flattables",
    operation_id="list_flat_tables",
    response_model=List[FlatTableSummaryResponse],
    response_model_by_alias=False,
    response_model_exclude_none=False,
)
def list_flat_tables(db: SessionWithUser = Depends(get_db_with_user)):
    "List all flat tables"
    flat_tables = flat_table_crud.get_flat_tables(db)
    return [flat_table_service.to_flat_table_summary(ft) for ft in flat_tables]


@router.patch(
    "/flattable/{id}",
    operation_id="update_flat_table",
    response_model=FlatTableResponse,
    response_model_by_alias=False,
    response_model_exclude_none=False,
)
def update_flat_table(
    id: str,
    update: FlatTableUpdateParams,
    db: SessionWithUser = Depends(get_db_with_user),
    settings: Settings = Depends(get_settings),
):
    """
    Update a flat table's given_id and/or name. Synchronous -- no file I/O is involved.
    """
    _assert_is_admin(db, settings)

    flat_table = _get_required_flat_table(db, id)

    with transaction(db):
        flat_table = flat_table_crud.update_flat_table(db, flat_table, update)

    return flat_table_service.to_flat_table_response(flat_table)


@router.delete("/flattable/{id}", operation_id="delete_flat_table")
def delete_flat_table(
    id: str,
    db: SessionWithUser = Depends(get_db_with_user),
    settings: Settings = Depends(get_settings),
):
    "Permanently delete a flat table and its underlying SQLite data file. Synchronous."
    _assert_is_admin(db, settings)

    flat_table = _get_required_flat_table(db, id)

    with transaction(db):
        flat_table_crud.delete_flat_table(db, flat_table, settings.filestore_location)

    return {"message": f"Deleted flat table {id}"}


@router.post(
    "/flattable/subset",
    operation_id="get_flat_table_subset",
    response_model=FlatTableSubsetResponse,
)
def get_flat_table_subset(
    request: FlatTableSubsetRequest,
    db: SessionWithUser = Depends(get_db_with_user),
    settings: Settings = Depends(get_settings),
):
    "Retrieve a subset of columns/rows from a flat table, based on filters (AND across columns)."
    flat_table = _get_required_flat_table(db, request.flat_table_id)
    return flat_table_service.get_flat_table_subset(settings, flat_table, request)
