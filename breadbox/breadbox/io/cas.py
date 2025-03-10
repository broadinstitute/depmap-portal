# -*- coding: utf-8 -*-
import hashlib
from base64 import urlsafe_b64encode
from sqlitedict import SqliteDict
from typing import Optional
from google.cloud import storage


def get_value(db_path: str, key: str) -> Optional[str]:
    with SqliteDict(db_path) as db:
        blob = db.get(key)
        if blob is None:
            return None
        return blob.decode("utf8")


def set_value(db_path: str, value: str) -> str:
    value_bytes = value.encode("utf8")
    key = urlsafe_b64encode(hashlib.sha256(value_bytes).digest()).decode("utf8")
    with SqliteDict(db_path) as db:
        db[key] = value_bytes
        db.commit()
    return key


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
