import logging

from depmap.utilities.sign_bucket_url import sign_url
from flask import (
    Blueprint,
    abort,
    current_app,
    redirect,
)
from google.cloud import storage
from datetime import datetime, timedelta

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

    client = storage.Client.from_service_account_json(
        current_app.config["DOWNLOADS_KEY"]
    )
    bucket = storage.Bucket(client, bucket_name)
    # Get the blob object
    blob = bucket.get_blob(filename)
    if blob is None:
        abort(404)
    else:
        # Reload the blob to ensure metadata is up-to-date
        blob.reload()
        # Generate signed url with expiration 24 hours from generation
        signed_url = blob.generate_signed_url(
            expiration=datetime.now() + timedelta(hours=24),
            response_disposition="inline",
            response_type=blob.content_type,
        )
        # Redirect to generated signed GCS url
        return redirect(signed_url)
