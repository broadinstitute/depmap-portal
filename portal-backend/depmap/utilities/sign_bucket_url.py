import base64
import json
import time
import urllib.parse
import re

from flask import current_app
from oauth2client.service_account import ServiceAccountCredentials


def _get_service_account_project_id(creds):
    # The spirit of this method is, given a oauth2client.service_account.ServiceAccountCredentials object
    # return the name of the project that owns that service account.
    #
    # this has the potential to break in the future because it's making a
    # bunch of assumptions which I'm not clear if we can rely upon. However,
    # these have remained stable for the last few years, so I have any reason
    # to expect them to change anytime soon.

    # This regex is to extract "broad-achilles" out of a service
    # account name like depmap-dmc-downloads@broad-achilles.iam.gserviceaccount.com
    m = re.match("[^@]+@([^.]+)\\..*", getattr(creds, "_service_account_email", ""))
    if m is None:
        return None
    else:
        return m.group(1)


def sign_url(
    creds,
    bucket,
    key,
    method="GET",
    md5="",
    content_type="",
    expiry_seconds=60 * 60 * 24,  # set the default expiry to 24hrs
    extension_headers=[],
    dl_name=None,
):
    query_parameters = []
    if dl_name:
        query_parameters.append(
            (
                "response-content-disposition",
                "attachment; filename=" + json.dumps(dl_name),
            )
        )
    key = urllib.parse.quote(key)

    expiry = int(time.time()) + expiry_seconds
    blob = "\n".join(
        [method, md5, content_type, str(expiry)]
        + extension_headers
        + ["/{}/{}".format(bucket, key)]
    )

    # see the blob we're signing to compare against google error messages
    # print("Blob", blob)

    client_id = creds.service_account_email
    signature = creds.sign_blob(blob)[1]
    encoded_signature = (
        base64.b64encode(signature)
        .decode("utf8")
        .replace("+", "%2B")
        .replace("/", "%2F")
    )

    query_parameters.extend(
        [
            ("GoogleAccessId", client_id),
            ("Expires", expiry),
            ("Signature", encoded_signature),
        ]
    )

    # for buckets which are configured "requester pays" use the project that owns the
    # service account as the project that should pay for the request.
    payee = _get_service_account_project_id(creds)
    if payee is not None:
        query_parameters.append(("userProject", payee))

    query_parameters_str = urllib.parse.urlencode(query_parameters)

    return "https://storage.googleapis.com/{}/{}?{}".format(
        bucket, key, query_parameters_str
    )


def get_signed_url(bucket: str, key: str) -> str:
    credentials = ServiceAccountCredentials.from_json_keyfile_name(
        current_app.config["DOWNLOADS_KEY"]
    )

    url = sign_url(credentials, bucket, key)

    return url
