import hashlib

from fastapi import status, Depends, Header
from fastapi.responses import ORJSONResponse, Response
from typing import Any, Callable, Optional, List, Union
from typing import Annotated


def get_client_etag(
    if_none_match: Annotated[
        Union[str, None], Header()
    ] = None,  # etag from the client's cache
) -> Union[str, None]:
    return if_none_match


RenderIfNew = Callable[[str, Callable[[], Any]], None]


def get_render_if_new(
    request_etag: Annotated[Optional[str], Depends(get_client_etag)]
) -> RenderIfNew:
    """
    Method intended to be used as a dependency to handle checking etag and only rendering a response
    if etag does not match.
    """

    def needs_render(
        current_etag: str, get_response_content_callback: Callable[[], Any]
    ):
        return get_response_with_etag(
            current_etag, request_etag, get_response_content_callback
        )

    return needs_render


def get_response_with_etag(
    etag: str,
    if_none_match: Optional[str],
    get_response_content_callback: Callable[[], Any],
) -> Response:
    """
    Helper function to handle ETag-based caching. This etag should be a hashed 
    value that represents the current state of the resource.
    
    Returns either a 304 Not Modified response if client's browser already has the 
    up-to-date response, or a 200 OK response with the content from the callback.
    """
    common = {"media_type": "application/json", "headers": {"ETag": etag}}
    if if_none_match and if_none_match == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, **common)

    return ORJSONResponse(
        status_code=status.HTTP_200_OK,
        content=get_response_content_callback(),
        **common
    )


def hash_id_list(values: list[str]):
    hash = hashlib.md5()
    for id in values:
        hash.update(id.encode())
    return hash.hexdigest()
