from http import HTTPStatus
from typing import Any, Dict, List, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.group_out import GroupOut
from ...models.http_error import HTTPError
from ...models.http_validation_error import HTTPValidationError
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    write_access: Union[None, Unset, bool] = UNSET,
) -> Dict[str, Any]:
    params: Dict[str, Any] = {}

    json_write_access: Union[None, Unset, bool]
    if isinstance(write_access, Unset):
        json_write_access = UNSET
    else:
        json_write_access = write_access
    params["write_access"] = json_write_access

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: Dict[str, Any] = {
        "method": "get",
        "url": "/groups/",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[HTTPError, HTTPValidationError, List["GroupOut"]]]:
    if response.status_code == HTTPStatus.OK:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in _response_200:
            response_200_item = GroupOut.from_dict(response_200_item_data)

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
) -> Response[Union[HTTPError, HTTPValidationError, List["GroupOut"]]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: Union[AuthenticatedClient, Client],
    write_access: Union[None, Unset, bool] = UNSET,
) -> Response[Union[HTTPError, HTTPValidationError, List["GroupOut"]]]:
    """Get Groups

     Get groups that the user has access to.

    If `write_access` is True (truthy), then only return groups that the user has write
    access to.

    Args:
        write_access (Union[None, Unset, bool]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[HTTPError, HTTPValidationError, List['GroupOut']]]
    """

    kwargs = _get_kwargs(
        write_access=write_access,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: Union[AuthenticatedClient, Client],
    write_access: Union[None, Unset, bool] = UNSET,
) -> Optional[Union[HTTPError, HTTPValidationError, List["GroupOut"]]]:
    """Get Groups

     Get groups that the user has access to.

    If `write_access` is True (truthy), then only return groups that the user has write
    access to.

    Args:
        write_access (Union[None, Unset, bool]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[HTTPError, HTTPValidationError, List['GroupOut']]
    """

    return sync_detailed(
        client=client,
        write_access=write_access,
    ).parsed


async def asyncio_detailed(
    *,
    client: Union[AuthenticatedClient, Client],
    write_access: Union[None, Unset, bool] = UNSET,
) -> Response[Union[HTTPError, HTTPValidationError, List["GroupOut"]]]:
    """Get Groups

     Get groups that the user has access to.

    If `write_access` is True (truthy), then only return groups that the user has write
    access to.

    Args:
        write_access (Union[None, Unset, bool]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[HTTPError, HTTPValidationError, List['GroupOut']]]
    """

    kwargs = _get_kwargs(
        write_access=write_access,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: Union[AuthenticatedClient, Client],
    write_access: Union[None, Unset, bool] = UNSET,
) -> Optional[Union[HTTPError, HTTPValidationError, List["GroupOut"]]]:
    """Get Groups

     Get groups that the user has access to.

    If `write_access` is True (truthy), then only return groups that the user has write
    access to.

    Args:
        write_access (Union[None, Unset, bool]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[HTTPError, HTTPValidationError, List['GroupOut']]
    """

    return (
        await asyncio_detailed(
            client=client,
            write_access=write_access,
        )
    ).parsed