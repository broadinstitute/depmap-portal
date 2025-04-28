# -*- coding: utf-8 -*-
import hashlib
from google.cloud import storage
from flask import current_app
from base64 import urlsafe_b64encode


def get_storage_client() -> storage.Client:
    client = storage.Client.from_service_account_json(
        current_app.config["DOWNLOADS_KEY"]
    )
    return client


def get_cas_bucket(client: storage.Client = None) -> storage.Bucket:
    if client is None:
        client = get_storage_client()
    bucket_name = current_app.config["CAS_BUCKET"]
    bucket = client.bucket(bucket_name)
    return bucket


def get_value(key: str) -> str:
    bucket = get_cas_bucket()
    blob = bucket.blob(key)
    if not blob.exists():
        return None
    return blob.download_as_string().decode("utf8")


def set_value(value: str) -> str:
    value_bytes = value.encode("utf8")
    bucket = get_cas_bucket()
    key = urlsafe_b64encode(hashlib.sha256(value_bytes).digest()).decode("utf8")
    blob = bucket.blob(key)
    if not blob.exists():
        blob.upload_from_string(value_bytes)
    return key
