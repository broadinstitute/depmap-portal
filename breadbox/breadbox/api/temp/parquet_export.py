from .router import router
from breadbox.schemas.parquet_export import (
    TabularSubsetOperation,
    MatrixSubsetOperation,
    ExportResult,
)
from typing import Annotated, Optional, Callable
from fastapi import APIRouter, Body, Depends, HTTPException
from breadbox.db.session import SessionLocalWithUser, SessionWithUser
from breadbox.api.dependencies import (
    get_db_with_user,
    get_filestore_location,
)
from breadbox.service.gcs import get_signed_key_generator, get_tempspace
from breadbox.service.parquet_export import materialize_matrix, materialize_tabular
from breadbox.service.tempspace import Tempspace

# how long urls returned by parquet-export are valid
default_expiration_minutes = 30


@router.post(
    "/parquet-export/tabular",
    operation_id="export_tabular",
    response_model=ExportResult,
)
def export_tabular(
    op: TabularSubsetOperation,
    db: Annotated[SessionWithUser, Depends(get_db_with_user)],
    tempspace: Annotated[Tempspace, Depends(get_tempspace)],
    signed_url_generator: Annotated[
        Callable[[str, int], str], Depends(get_signed_key_generator)
    ],
):
    gcs_path = materialize_tabular(db, op, tempspace)
    return ExportResult(url=signed_url_generator(gcs_path, default_expiration_minutes))


@router.post(
    "/parquet-export/matrix", operation_id="export_matrix", response_model=ExportResult,
)
def export_matrix(
    op: MatrixSubsetOperation,
    db: Annotated[SessionWithUser, Depends(get_db_with_user)],
    tempspace: Annotated[Tempspace, Depends(get_tempspace)],
    filestore_location: Annotated[str, Depends(get_filestore_location)],
    signed_url_generator: Annotated[
        Callable[[str, int], str], Depends(get_signed_key_generator)
    ],
):
    gcs_path = materialize_matrix(db, filestore_location, op, tempspace)
    return ExportResult(url=signed_url_generator(gcs_path, default_expiration_minutes))
