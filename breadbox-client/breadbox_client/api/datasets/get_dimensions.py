from http import HTTPStatus
from typing import Any, Dict, List, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.dimension_search_index_response import DimensionSearchIndexResponse
from ...models.http_error import HTTPError
from ...models.http_validation_error import HTTPValidationError
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    limit: int,
    include_referenced_by: Union[Unset, str] = "F",
    prefix: Union[None, Unset, str] = UNSET,
    substring: Union[List[str], None, Unset] = UNSET,
    type_name: Union[None, Unset, str] = UNSET,
) -> Dict[str, Any]:
    params: Dict[str, Any] = {}

    params["limit"] = limit

    params["include_referenced_by"] = include_referenced_by

    json_prefix: Union[None, Unset, str]
    if isinstance(prefix, Unset):
        json_prefix = UNSET
    else:
        json_prefix = prefix
    params["prefix"] = json_prefix

    json_substring: Union[List[str], None, Unset]
    if isinstance(substring, Unset):
        json_substring = UNSET
    elif isinstance(substring, list):
        json_substring = substring

    else:
        json_substring = substring
    params["substring"] = json_substring

    json_type_name: Union[None, Unset, str]
    if isinstance(type_name, Unset):
        json_type_name = UNSET
    else:
        json_type_name = type_name
    params["type_name"] = json_type_name

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: Dict[str, Any] = {
        "method": "get",
        "url": "/datasets/dimensions/",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[
    Union[HTTPError, HTTPValidationError, List["DimensionSearchIndexResponse"]]
]:
    if response.status_code == HTTPStatus.OK:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in _response_200:
            response_200_item = DimensionSearchIndexResponse.from_dict(
                response_200_item_data
            )

            response_200.append(response_200_item)

        return response_200
    if response.status_code == HTTPStatus.BAD_REQUEST:
        response_400 = HTTPError.from_dict(response.json())

        return response_400
    if response.status_code == HTTPStatus.FORBIDDEN:
        response_403 = HTTPError.from_dict(response.json())

        return response_403
    if response.status_code == HTTPStatus.NOT_FOUND:
        response_404 = HTTPError.from_dict(response.json())

        return response_404
    if response.status_code == HTTPStatus.CONFLICT:
        response_409 = HTTPError.from_dict(response.json())

        return response_409
    if response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY:
        response_422 = HTTPValidationError.from_dict(response.json())

        return response_422
    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Response[
    Union[HTTPError, HTTPValidationError, List["DimensionSearchIndexResponse"]]
]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: Union[AuthenticatedClient, Client],
    limit: int,
    include_referenced_by: Union[Unset, str] = "F",
    prefix: Union[None, Unset, str] = UNSET,
    substring: Union[List[str], None, Unset] = UNSET,
    type_name: Union[None, Unset, str] = UNSET,
) -> Response[
    Union[HTTPError, HTTPValidationError, List["DimensionSearchIndexResponse"]]
]:
    """Get Dimensions

     Get dimension search index results for the given prefix, with results ordered by priority and then
    label.

    Args:
        limit (int):
        include_referenced_by (Union[Unset, str]):  Default: 'F'.
        prefix (Union[None, Unset, str]):
        substring (Union[List[str], None, Unset]):
        type_name (Union[None, Unset, str]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[HTTPError, HTTPValidationError, List['DimensionSearchIndexResponse']]]
    """

    kwargs = _get_kwargs(
        limit=limit,
        include_referenced_by=include_referenced_by,
        prefix=prefix,
        substring=substring,
        type_name=type_name,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: Union[AuthenticatedClient, Client],
    limit: int,
    include_referenced_by: Union[Unset, str] = "F",
    prefix: Union[None, Unset, str] = UNSET,
    substring: Union[List[str], None, Unset] = UNSET,
    type_name: Union[None, Unset, str] = UNSET,
) -> Optional[
    Union[HTTPError, HTTPValidationError, List["DimensionSearchIndexResponse"]]
]:
    """Get Dimensions

     Get dimension search index results for the given prefix, with results ordered by priority and then
    label.

    Args:
        limit (int):
        include_referenced_by (Union[Unset, str]):  Default: 'F'.
        prefix (Union[None, Unset, str]):
        substring (Union[List[str], None, Unset]):
        type_name (Union[None, Unset, str]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[HTTPError, HTTPValidationError, List['DimensionSearchIndexResponse']]
    """

    return sync_detailed(
        client=client,
        limit=limit,
        include_referenced_by=include_referenced_by,
        prefix=prefix,
        substring=substring,
        type_name=type_name,
    ).parsed


async def asyncio_detailed(
    *,
    client: Union[AuthenticatedClient, Client],
    limit: int,
    include_referenced_by: Union[Unset, str] = "F",
    prefix: Union[None, Unset, str] = UNSET,
    substring: Union[List[str], None, Unset] = UNSET,
    type_name: Union[None, Unset, str] = UNSET,
) -> Response[
    Union[HTTPError, HTTPValidationError, List["DimensionSearchIndexResponse"]]
]:
    """Get Dimensions

     Get dimension search index results for the given prefix, with results ordered by priority and then
    label.

    Args:
        limit (int):
        include_referenced_by (Union[Unset, str]):  Default: 'F'.
        prefix (Union[None, Unset, str]):
        substring (Union[List[str], None, Unset]):
        type_name (Union[None, Unset, str]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[HTTPError, HTTPValidationError, List['DimensionSearchIndexResponse']]]
    """

    kwargs = _get_kwargs(
        limit=limit,
        include_referenced_by=include_referenced_by,
        prefix=prefix,
        substring=substring,
        type_name=type_name,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: Union[AuthenticatedClient, Client],
    limit: int,
    include_referenced_by: Union[Unset, str] = "F",
    prefix: Union[None, Unset, str] = UNSET,
    substring: Union[List[str], None, Unset] = UNSET,
    type_name: Union[None, Unset, str] = UNSET,
) -> Optional[
    Union[HTTPError, HTTPValidationError, List["DimensionSearchIndexResponse"]]
]:
    """Get Dimensions

     Get dimension search index results for the given prefix, with results ordered by priority and then
    label.

    Args:
        limit (int):
        include_referenced_by (Union[Unset, str]):  Default: 'F'.
        prefix (Union[None, Unset, str]):
        substring (Union[List[str], None, Unset]):
        type_name (Union[None, Unset, str]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[HTTPError, HTTPValidationError, List['DimensionSearchIndexResponse']]
    """

    return (
        await asyncio_detailed(
            client=client,
            limit=limit,
            include_referenced_by=include_referenced_by,
            prefix=prefix,
            substring=substring,
            type_name=type_name,
        )
    ).parsed
