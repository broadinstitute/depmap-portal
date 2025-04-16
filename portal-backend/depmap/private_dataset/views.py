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
