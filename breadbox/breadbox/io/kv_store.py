from sqlitedict import SqliteDict
from typing import Optional
from base64 import urlsafe_b64encode


def get_value(db_path: str, key: str) -> Optional[str]:
    with SqliteDict(db_path) as db:
        blob = db.get(key)
        if blob is None:
            return None
        return blob.decode("utf8")


def set_value(db_path: str, key: str, value_bytes: bytes) -> str:
    with SqliteDict(db_path) as db:
        db[key] = value_bytes
        db.commit()
    return key
