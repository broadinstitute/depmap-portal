import datetime
import os
from urllib.parse import urlsplit
from google.cloud import storage
from google.oauth2 import service_account
from typing import Annotated, Callable, Optional
from breadbox.config import Settings
from breadbox.api.dependencies import get_settings
from fastapi import Depends, HTTPException
from breadbox.service.tempspace import Tempspace, GCSObjStore, FileObjStore

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


def use_local_export_storage(settings: Settings) -> bool:
    """
    True when exports should be written to the local filesystem instead of GCS.

    Deliberately narrow: only when no GCS credentials are configured AND Breadbox is
    running with BREADBOX_ENV=dev. A deployed environment (any other BREADBOX_ENV) can
    never take this path; with no credentials it gets a clear error instead.
    """
    return settings.gcs_credentials_path is None and settings.breadbox_env == "dev"


def get_local_export_dir(settings: Settings) -> str:
    """Resolved (symlink-free) absolute directory that local-mode exports are written to."""
    path = settings.local_export_dir or os.path.join(
        settings.compute_results_location, "parquet-export"
    )
    path = os.path.realpath(os.path.abspath(path))
    os.makedirs(path, exist_ok=True)
    return path


def get_gcs_client(
    settings: Annotated[Settings, Depends(get_settings)]
) -> Optional[storage.Client]:
    """
    Returns a GCS client, or None when running in local-export mode (see
    `use_local_export_storage`). Raises a clear 503 if GCS is not configured and local
    mode isn't allowed.
    """
    if use_local_export_storage(settings):
        return None
    if settings.gcs_credentials_path is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "Exports require GCS, but GCS_CREDENTIALS_PATH is not set. "
                "(Local-storage exports are only available when BREADBOX_ENV=dev.)"
            ),
        )
    return storage.Client.from_service_account_json(settings.gcs_credentials_path)


def get_signed_key_generator(
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[Optional[storage.Client], Depends(get_gcs_client)],
) -> Callable[[str, int], str]:
    if client is None:
        # local mode: the "url" is just the absolute local path of the parquet file
        def local_key_generator(path: str, expiration_minutes: int) -> str:
            return path

        return local_key_generator

    def signed_key_generator(gcs_path: str, expiration_minutes: int) -> str:
        return generate_signed_url(
            client, gcs_path, expiration_minutes=expiration_minutes
        )

    return signed_key_generator


def get_tempspace(
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[Optional[storage.Client], Depends(get_gcs_client)],
):
    if client is None:
        return Tempspace(FileObjStore(get_local_export_dir(settings)), default_interval)

    gcs_temp_path = settings.gcs_temp_path
    if gcs_temp_path is None:
        raise HTTPException(
            status_code=503,
            detail="Exports require GCS, but GCS_TEMP_PATH is not set.",
        )
    bucket_name, prefix = parse_gs_path(gcs_temp_path)
    gcs = GCSObjStore(client, bucket_name, prefix)
    return Tempspace(gcs, default_interval)
