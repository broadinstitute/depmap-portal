import logging
import json
from depmap.access_control import get_authenticated_user
from flask import request
import datetime

log = logging.getLogger("depmap.data_access")


def _get_authenticated_user():
    try:
        return get_authenticated_user()
    except RuntimeError:
        # if this fails, it's likely due to "Working outside of request context."
        # such as when this is called inside of the worker instead of the web server
        return "<unknown>"


def _get_endpoint():
    try:
        return request.endpoint
    except RuntimeError:
        # if this fails, it's likely due to "Working outside of request context."
        # such as when this is called inside of the worker instead of the web server
        return "<unknown>"


def log_feature_access(function_name, dataset_id, feature_label):
    log.info(
        "%s",
        json.dumps(
            dict(
                timestamp=datetime.datetime.now().isoformat(),
                type="feature-access",
                endpoint=_get_endpoint(),
                function=function_name,
                dataset=dataset_id,
                feature=feature_label,
                user=_get_authenticated_user(),
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
                endpoint=_get_endpoint(),
                function=function_name,
                filename=filename,
                user=_get_authenticated_user(),
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
                endpoint=_get_endpoint(),
                function=function_name,
                dataset=dataset_id,
                user=_get_authenticated_user(),
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
                endpoint=_get_endpoint(),
                user=_get_authenticated_user(),
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
                endpoint=_get_endpoint(),
                function=function_name,
                dataset_ids=dataset_ids,
                user=_get_authenticated_user(),
            )
        ),
    )
