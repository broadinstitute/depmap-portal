import json
from typing import Dict

import celery

from breadbox.db.session import SessionWithUser
from breadbox.schemas.flat_table import FlatTableCreateParams, FlatTableResponse
from breadbox.service import flat_table as flat_table_service

from ..config import get_settings
from .celery import LogErrorsTask, app
from .dataset_tasks import db_context


@app.task(base=LogErrorsTask, bind=True)
def run_flat_table_upload(
    self: celery.Task, flat_table_params: Dict, user: str,
):
    with db_context(user, commit=True) as db:
        params = FlatTableCreateParams(**flat_table_params)
        response = create_flat_table_upload(db, params)

        # because celery is going to want to serialize the response, convert it to a
        # json dict before returning it
        return json.loads(response.json())


def create_flat_table_upload(
    db: SessionWithUser, params: FlatTableCreateParams,
) -> FlatTableResponse:
    settings = get_settings()

    flat_table = flat_table_service.create_flat_table_from_upload(db, settings, params)

    return flat_table_service.to_flat_table_response(flat_table)
