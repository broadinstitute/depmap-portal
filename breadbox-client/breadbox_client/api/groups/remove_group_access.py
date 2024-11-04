from http import HTTPStatus
from typing import Any, Dict, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.http_error import HTTPError
from ...models.http_validation_error import HTTPValidationError
from ...types import Response


def _get_kwargs(
    group_entry_id: str,
) -> Dict[str, Any]:
    _kwargs: Dict[str, Any] = {
        "method": "delete",
        "url": "/groups/{group_entry_id}/removeAccess".format(
            group_entry_id=group_entry_id,
        ),
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Any, HTTPError, HTTPValidationError]]:
    if response.status_code == HTTPStatus.OK:
        response_200 = response.json()
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
) -> Response[Union[Any, HTTPError, HTTPValidationError]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    group_entry_id: str,
    *,
    client: Union[AuthenticatedClient, Client],
) -> Response[Union[Any, HTTPError, HTTPValidationError]]:
    """Delete Group Entry

     Remove group entry by a given group entry id. Only users with write access can delete entries

    Args:
        group_entry_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Any, HTTPError, HTTPValidationError]]
    """

    kwargs = _get_kwargs(
        group_entry_id=group_entry_id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    group_entry_id: str,
    *,
    client: Union[AuthenticatedClient, Client],
) -> Optional[Union[Any, HTTPError, HTTPValidationError]]:
    """Delete Group Entry

     Remove group entry by a given group entry id. Only users with write access can delete entries

    Args:
        group_entry_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Any, HTTPError, HTTPValidationError]
    """

    return sync_detailed(
        group_entry_id=group_entry_id,
        client=client,
    ).parsed


async def asyncio_detailed(
    group_entry_id: str,
    *,
    client: Union[AuthenticatedClient, Client],
) -> Response[Union[Any, HTTPError, HTTPValidationError]]:
    """Delete Group Entry

     Remove group entry by a given group entry id. Only users with write access can delete entries

    Args:
        group_entry_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Any, HTTPError, HTTPValidationError]]
    """

    kwargs = _get_kwargs(
        group_entry_id=group_entry_id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    group_entry_id: str,
    *,
    client: Union[AuthenticatedClient, Client],
) -> Optional[Union[Any, HTTPError, HTTPValidationError]]:
    """Delete Group Entry

     Remove group entry by a given group entry id. Only users with write access can delete entries

    Args:
        group_entry_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Any, HTTPError, HTTPValidationError]
    """

    return (
        await asyncio_detailed(
            group_entry_id=group_entry_id,
            client=client,
        )
    ).parsed
