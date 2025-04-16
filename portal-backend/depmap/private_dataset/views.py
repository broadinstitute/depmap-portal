# -*- coding: utf-8 -*-
from depmap.enums import DataTypeEnum
from flask import Blueprint, abort, current_app, render_template, request, url_for

from depmap import data_access
from depmap.access_control import get_visible_owner_id_configs
from depmap.celery_task.utils import format_task_status
from depmap.extensions import csrf_protect
from depmap.user_uploads.utils import (
    delete_private_datasets,
    get_user_upload_records,
    update_user_upload_records,
    get_task,
)
from depmap.interactive.nonstandard import nonstandard_utils
from depmap.utilities.data_access_log import log_legacy_private_dataset_access

blueprint = Blueprint(
    "private_dataset",
    __name__,
    url_prefix="/private_dataset",
    static_folder="../static",
)


# TODO: this should use the common task status endpoint
@blueprint.route("/upload_status/<task_id>", methods=["GET"])
def get_upload_task_status(task_id: str):
    if not current_app.config["ENABLED_FEATURES"].private_datasets:
        abort(404)

    result = get_task(task_id)
    return format_task_status(result)


@blueprint.route("/delete", methods=["DELETE"])
@csrf_protect.exempt
def delete_datasets():
    if not current_app.config["ENABLED_FEATURES"].private_datasets:
        abort(404)

    all_allowed_datasets = data_access.get_private_datasets()

    dataset_ids = [
        dataset_id
        for dataset_id in request.get_json().get("dataset_ids")
        if dataset_id in all_allowed_datasets
    ]
    deleted_dataset_ids = delete_private_datasets(dataset_ids)

    df = get_user_upload_records()
    drop_rows = df[df["dataset_id"].isin(deleted_dataset_ids)]
    df.drop(drop_rows.index, inplace=True)

    update_user_upload_records(df)

    return ("", 204)
