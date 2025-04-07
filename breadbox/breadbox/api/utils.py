import hashlib

from fastapi import Request, status
from fastapi.responses import ORJSONResponse, Response
from typing import Callable, Any


def get_not_modified_response(etag: str) -> Response:
    """
    Returns either a 304 Not Modified response which indicates the client's 
    browser already has the up-to-date response cached.
    """
    headers = {"media_type": "application/json", "headers": {"ETag": etag}}
    return Response(status_code=status.HTTP_304_NOT_MODIFIED, **headers)


def get_response_with_etag(content: Any, etag: str) -> Response:
    """
    This response format indicates that the browser should cache the response
    and use the ETag value to check for changes in the future.
    """
    headers = {"media_type": "application/json", "headers": {"ETag": etag}}
    return ORJSONResponse(status_code=status.HTTP_200_OK, content=content, **headers)


def hash_id_list(values: list[str]):
    hash = hashlib.md5()
    for id in values:
        hash.update(id.encode())
    return hash.hexdigest()
