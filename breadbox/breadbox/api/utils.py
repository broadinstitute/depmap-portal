import hashlib
import json
from pydantic import Json, TypeAdapter

from fastapi import status, Depends, Header
from fastapi.responses import ORJSONResponse, Response
from typing import Any, Callable, Dict, Optional, List, Union
from typing import Annotated
from typing import Any, Callable, Optional, Protocol

from breadbox.crud.table_mutation import get_mutation_counts
from breadbox.db.session import SessionWithUser


def get_client_etag(
    if_none_match: Annotated[
        Union[str, None], Header()
    ] = None,  # etag from the client's cache
) -> Union[str, None]:
    return if_none_match


class RenderIfChanged(Protocol):
    def __call__(
        self,
        db: SessionWithUser,
        tables_to_check: List[str],
        get_response_content_callback: Callable[[], Any],
        *,
        response_model: Optional[Any] = None,
        ignore_user: bool = False,
        extra: Optional[Any] = None
    ) -> Response:
        ...


def get_render_if_changed(
    request_etag: Annotated[Optional[str], Depends(get_client_etag)],
) -> RenderIfChanged:
    """
    Method intended to be used as a dependency to handle checking etag and only rendering a response
    if etag does not match.
    """

    def needs_render(
        db: SessionWithUser,
        tables_to_check: List[str],
        get_response_content_callback: Callable[[], Any],
        *,
        response_model: Optional[Any] = None,
        ignore_user: bool = False,
        extra: Optional[Any] = None
    ):
        if extra is None:
            extra = {}

        # don't want to mutate a passed in `extra` so wrap it in another dict that we own
        _extra = {"extra": extra}
        if not ignore_user:
            # special case: include user in the etag by default. We allow callers to opt-out
            # but we want to bias towards not doing anything which might allow leaks across users.
            # the http client will be able to cache using the key (url + etag), but the user
            # doesn't appear in the url (as it's sent via http header) so always encode it into the etag.
            # (Unless the caller can promise that the result doesn't depend on user)
            #
            # Also note: Today we're hashing the literal user. However, we could increase our cache hit rate
            # by instead looking up the group IDs associated with the user and encoding those. Many users
            # are members of the same group_id set, so etags could be common across users. Just noting as
            # a possibility for a future optimization if necessary.
            _extra["user"] = db.user

        current_etag = create_etag_from_mutation_counts(db, tables_to_check, _extra)

        return get_response_with_etag(
            current_etag, request_etag, get_response_content_callback, response_model
        )

    return needs_render


def get_response_with_etag(
    etag: str,
    if_none_match: Optional[str],
    get_response_content_callback: Callable[[], Any],
    response_model: Optional[type],
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

    result = get_response_content_callback()
    if response_model is not None:
        # render_if_new builds the response itself, so FastAPI's response_model isn't applied.
        # Serialize the ORM objects the same way here.
        adapter = TypeAdapter(response_model)
        content = adapter.dump_python(
            adapter.validate_python(result, from_attributes=True),
            mode="json",
            by_alias=False,
        )
    else:
        content = result

    return ORJSONResponse(status_code=status.HTTP_200_OK, content=content, **common)


def hash_id_list(values: list[str]):
    hash = hashlib.md5()
    for id in values:
        hash.update(id.encode())
    return hash.hexdigest()


def create_etag_from_mutation_counts(
    db: SessionWithUser, tables_to_check: List[str], extra: Dict[str, Any]
) -> str:
    """
    Computes an etag from how many times each of the given tables have been mutated (see table_mutation).
    `extra` is any other information which the response depends on (for example, the user for responses
    which differ by user), which is hashed along with the counts.

    We want this calc to be as fast as possible, so rather than hash all of the things which can change, we're
    storing a mutation count which acts as a etag for the entire state of a table, and we hash those all together.
    """
    key = {**extra, "mutation_counts": get_mutation_counts(db, tables_to_check)}
    return hashlib.md5(json.dumps(key, sort_keys=True).encode()).hexdigest()
