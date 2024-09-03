import logging

from depmap.utilities.sign_bucket_url import sign_url
from flask import (
    Blueprint,
    abort,
    current_app,
    redirect,
)
from oauth2client.service_account import ServiceAccountCredentials

log = logging.getLogger(__name__)

blueprint = Blueprint(
    "private", __name__, url_prefix="/private", static_folder="../static"
)


@blueprint.route("/<bucket_name>/<path:filename>")
def portal_file_private_url(bucket_name, filename):
    private_file_buckets = current_app.config.get("PRIVATE_FILE_BUCKETS")
    # Make sure bucket provided is accepted in valid list of buckets
    if private_file_buckets is None or bucket_name not in private_file_buckets:
        abort(404)

    credentials = ServiceAccountCredentials.from_json_keyfile_name(
        current_app.config["DOWNLOADS_KEY"]
    )
    signed_url = sign_url(credentials, bucket_name, filename)

    # Redirect to generated signed GCS url
    return redirect(signed_url)
