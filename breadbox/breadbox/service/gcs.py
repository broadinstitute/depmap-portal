import datetime
from urllib.parse import urlsplit
from google.cloud import storage
from google.oauth2 import service_account
from typing import Annotated, Callable
from breadbox.config import Settings
from breadbox.api.dependencies import get_settings
from fastapi import Depends
from breadbox.service.tempspace import Tempspace, GCSObjStore

# set up our caching for temp space to retain files for at least 15 days
default_interval = 60 * 60 * 24 * 15


def parse_gs_path(gs_path: str) -> tuple[str, str]:
    """
    Split a `gs://bucket/key` path into (bucket_name, blob_name).
    """
    parts = urlsplit(gs_path)
    if parts.scheme != "gs" or not parts.netloc:
        raise ValueError(f"Not a valid gs:// path: {gs_path!r}")

    bucket_name = parts.netloc
    blob_name = parts.path.lstrip("/")
    if not blob_name:
        raise ValueError(f"gs:// path is missing an object name: {gs_path!r}")

    return bucket_name, blob_name


def generate_signed_url(
    client: storage.Client, gs_path: str, expiration_minutes: int = 15,
) -> str:
    """
    Generate a V4 signed URL for reading (GET) a GCS object.

    Note: GCS signed URLs for GET requests inherently support byte-range
    reads. Since the `Range` header is not part of the signed request by
    default, a client can attach any `Range: bytes=start-end` header to
    the signed URL request and GCS will honor it (returning a 206 Partial
    Content response) without needing anything special done at signing time.

    Args:
        gs_path: Path to the object in the form `gs://bucket/key`.
        credentials: Note ADC via metadata server (e.g. Compute Engine default SA)
            cannot sign URLs directly; you need a service account key or
            impersonation credentials for that case
        expiration_minutes: How long the URL should remain valid.

    Returns:
        A signed URL string.
    """
    bucket_name, blob_name = parse_gs_path(gs_path)

    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_name)

    url = blob.generate_signed_url(
        version="v4",
        expiration=datetime.timedelta(minutes=expiration_minutes),
        method="GET",
    )

    return url


def get_gcs_client(settings: Annotated[Settings, Depends(get_settings)]):
    client = storage.Client.from_service_account_json(settings.gcs_credentials_path)
    return client


def get_signed_key_generator(
    client: Annotated[storage.Client, Depends(get_gcs_client)]
) -> Callable[[str, int], str]:
    def signed_key_generator(gcs_path: str, expiration_minutes: int) -> str:
        return generate_signed_url(
            client, gcs_path, expiration_minutes=expiration_minutes
        )

    return signed_key_generator


def get_tempspace(
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[storage.Client, Depends(get_gcs_client)],
):
    gcs_temp_path = settings.gcs_temp_path
    assert gcs_temp_path is not None
    bucket_name, prefix = parse_gs_path(gcs_temp_path)
    gcs = GCSObjStore(client, bucket_name, prefix)
    return Tempspace(gcs, default_interval)
