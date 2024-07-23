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


def log_legacy_private_dataset_access(function_name, dataset_ids):
    """
    In theory, once we switch to the new private dataset UI,
    private datasets should no longer be accessed through the legacy system.
    If we see logs where they are being accessed, then we'll know there are other 
    features that need to be updated. 
    """
    log.info(
        "%s",
        json.dumps(
            dict(
                timestamp=datetime.datetime.now().isoformat(),
                type="legacy-private-dataset-access",
                endpoint=request.endpoint,
                function=function_name,
                dataset_ids=dataset_ids,
                user=get_authenticated_user(),
            )
        ),
    )
