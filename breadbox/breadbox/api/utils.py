import hashlib

from fastapi import status
from fastapi.responses import ORJSONResponse, Response
from typing import Any, Callable, Optional, List


def get_response_with_etag(
    etag: str, 
    if_none_match: Optional[List[str]],
    get_response_content_callback: Callable[[], Any]
) -> Response:
    """
    Helper function to handle ETag-based caching. This etag should be a hashed 
    value that represents the current state of the resource.
    
    Returns either a 304 Not Modified response if client's browser already has the 
    up-to-date response, or a 200 OK response with the content from the callback.
    """
    common = {"media_type": "application/json", "headers": {"ETag": etag}}
    if if_none_match and if_none_match[0] == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, **common)
    return ORJSONResponse(status_code=status.HTTP_200_OK, content=get_response_content_callback(), **common)


def hash_id_list(values: list[str]):
    hash = hashlib.md5()
    for id in values:
        hash.update(id.encode())
    return hash.hexdigest()
