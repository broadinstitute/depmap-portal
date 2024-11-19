# -*- coding: utf-8 -*-
import hashlib
from base64 import urlsafe_b64encode
from sqlitedict import SqliteDict
from typing import Optional


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
