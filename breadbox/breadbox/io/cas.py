# -*- coding: utf-8 -*-
import hashlib
from base64 import urlsafe_b64encode
from typing import Optional
from google.cloud import storage
from . import kv_store


def get_value(db_path: str, key: str) -> Optional[str]:
    return kv_store.get_value(db_path, key)


def set_value(db_path: str, value: str) -> str:
    value_bytes = value.encode("utf8")
    key = urlsafe_b64encode(hashlib.sha256(value_bytes).digest()).decode("utf8")
    return kv_store.set_value(db_path, key, value_bytes)


##########
# Legacy methods for getting/setting values in google bucket


def _get_private_datasets_bucket(bucket_name: str) -> storage.Bucket:
    client = storage.Client()

    bucket = client.bucket(bucket_name)
    return bucket


def legacy_get_value(bucket_name: str, key: str) -> Optional[str]:
    bucket = _get_private_datasets_bucket(bucket_name)

    blob = bucket.blob(key)
    if not blob.exists():
        return None

    return blob.download_as_string().decode("utf8")


def legacy_set_value(bucket_name: str, value: str) -> Optional[str]:
    bucket = _get_private_datasets_bucket(bucket_name)

    value_bytes = value.encode("utf8")
    key = urlsafe_b64encode(hashlib.sha256(value_bytes).digest()).decode("utf8")
    blob = bucket.blob(key)
    if not blob.exists():
        blob.upload_from_string(value_bytes)
    return key
