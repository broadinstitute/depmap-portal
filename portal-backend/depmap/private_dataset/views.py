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
from depmap.vector_catalog.trees import OTHER_DATASET_NON_PREPOPULATE_ID_BASE
from depmap.interactive.nonstandard import nonstandard_utils

blueprint = Blueprint(
    "private_dataset",
    __name__,
    url_prefix="/private_dataset",
    static_folder="../static",
)


@blueprint.route("/")
def home():
    if not current_app.config["ENABLED_FEATURES"].private_datasets:
        abort(404)

    datasets = data_access.get_private_datasets()
    datasets = [
        {
            "dataset_id": dataset_id,
            "display_name": config.label,
            "private_group_display_name": config.private_group_display_name,
            "data_explorer_url": url_for(
                "data_explorer_2.view_data_explorer_2",
                # Data Explorer 2 links require an xFeature (it does not
                # support linking to a partially defined plot)
                xFeature=nonstandard_utils.get_random_row_name(dataset_id),
                xDataset=dataset_id,
            )
            if current_app.config["ENABLED_FEATURES"].data_explorer_2
            else url_for(
                "interactive.view_interactive",
                # HACK: https://app.asana.com/0/1165651979405609/1200725631412715
                x=f"{OTHER_DATASET_NON_PREPOPULATE_ID_BASE}/{dataset_id}",
            ),
        }
        for dataset_id, config in datasets.items()
    ]
    # upload_url = url_for("private_dataset.upload")
    visible_owner_ids = get_visible_owner_id_configs(write_access=True)
    print(f"visible_owner_ids={visible_owner_ids}")
    return render_template(
        "private_dataset/index.html",
        datasets=datasets,
        data_explorer_url=url_for("data_explorer_2.view_data_explorer_2")
        if current_app.config["ENABLED_FEATURES"].data_explorer_2
        else url_for("interactive.view_interactive"),
        groups=[
            {"groupId": k, "displayName": v.display_name}
            for k, v in visible_owner_ids.items()
        ],
        dataTypes=[dataType.value for dataType in DataTypeEnum],
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
