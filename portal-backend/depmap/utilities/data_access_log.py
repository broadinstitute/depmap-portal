import logging
import json
from depmap.access_control import get_authenticated_user
from flask import request
import datetime

log = logging.getLogger("depmap.data_access")


def log_feature_access(function_name, dataset_id, feature_label):
    log.info(
        "%s",
        json.dumps(
            dict(
                timestamp=datetime.datetime.now().isoformat(),
                type="feature-access",
                endpoint=request.endpoint,
                function=function_name,
                dataset=dataset_id,
                feature=feature_label,
                user=get_authenticated_user(),
            )
        ),
    )


def log_download_file_access(function_name, filename):
    log.info(
        "%s",
        json.dumps(
            dict(
                timestamp=datetime.datetime.now().isoformat(),
                type="download-file",
                endpoint=request.endpoint,
                function=function_name,
                filename=filename,
                user=get_authenticated_user(),
            )
        ),
    )


def log_dataset_access(function_name, dataset_id):
    log.info(
        "%s",
        json.dumps(
            dict(
                timestamp=datetime.datetime.now().isoformat(),
                type="feature-access",
                endpoint=request.endpoint,
                function=function_name,
                dataset=dataset_id,
                user=get_authenticated_user(),
            )
        ),
    )


def log_bulk_download_csv():
    log.info(
        "%s",
        json.dumps(
            dict(
                timestamp=datetime.datetime.now().isoformat(),
                type="download-csv",
                endpoint=request.endpoint,
                user=get_authenticated_user(),
            )
        ),
    )
