from http import HTTPStatus
from typing import Any, Dict, List, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.dimension_identifiers import DimensionIdentifiers
from ...models.http_error import HTTPError
from ...models.http_validation_error import HTTPValidationError
from ...types import UNSET, Response, Unset


def _get_kwargs(
    name: str,
    *,
    data_type: Union[None, Unset, str] = UNSET,
    show_only_dimensions_in_datasets: Union[Unset, bool] = False,
) -> Dict[str, Any]:
    params: Dict[str, Any] = {}

    json_data_type: Union[None, Unset, str]
    if isinstance(data_type, Unset):
        json_data_type = UNSET
    else:
        json_data_type = data_type
    params["data_type"] = json_data_type

    params["show_only_dimensions_in_datasets"] = show_only_dimensions_in_datasets

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: Dict[str, Any] = {
        "method": "get",
        "url": "/types/dimensions/{name}/identifiers".format(
            name=name,
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[HTTPError, HTTPValidationError, List["DimensionIdentifiers"]]]:
    if response.status_code == HTTPStatus.OK:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in _response_200:
            response_200_item = DimensionIdentifiers.from_dict(response_200_item_data)

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
) -> Response[Union[HTTPError, HTTPValidationError, List["DimensionIdentifiers"]]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    name: str,
    *,
    client: Union[AuthenticatedClient, Client],
    data_type: Union[None, Unset, str] = UNSET,
    show_only_dimensions_in_datasets: Union[Unset, bool] = False,
) -> Response[Union[HTTPError, HTTPValidationError, List["DimensionIdentifiers"]]]:
    """Get Dimension Type Identifiers

    Args:
        name (str):
        data_type (Union[None, Unset, str]):
        show_only_dimensions_in_datasets (Union[Unset, bool]):  Default: False.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[HTTPError, HTTPValidationError, List['DimensionIdentifiers']]]
    """

    kwargs = _get_kwargs(
        name=name,
        data_type=data_type,
        show_only_dimensions_in_datasets=show_only_dimensions_in_datasets,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    name: str,
    *,
    client: Union[AuthenticatedClient, Client],
    data_type: Union[None, Unset, str] = UNSET,
    show_only_dimensions_in_datasets: Union[Unset, bool] = False,
) -> Optional[Union[HTTPError, HTTPValidationError, List["DimensionIdentifiers"]]]:
    """Get Dimension Type Identifiers

    Args:
        name (str):
        data_type (Union[None, Unset, str]):
        show_only_dimensions_in_datasets (Union[Unset, bool]):  Default: False.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[HTTPError, HTTPValidationError, List['DimensionIdentifiers']]
    """

    return sync_detailed(
        name=name,
        client=client,
        data_type=data_type,
        show_only_dimensions_in_datasets=show_only_dimensions_in_datasets,
    ).parsed


async def asyncio_detailed(
    name: str,
    *,
    client: Union[AuthenticatedClient, Client],
    data_type: Union[None, Unset, str] = UNSET,
    show_only_dimensions_in_datasets: Union[Unset, bool] = False,
) -> Response[Union[HTTPError, HTTPValidationError, List["DimensionIdentifiers"]]]:
    """Get Dimension Type Identifiers

    Args:
        name (str):
        data_type (Union[None, Unset, str]):
        show_only_dimensions_in_datasets (Union[Unset, bool]):  Default: False.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[HTTPError, HTTPValidationError, List['DimensionIdentifiers']]]
    """

    kwargs = _get_kwargs(
        name=name,
        data_type=data_type,
        show_only_dimensions_in_datasets=show_only_dimensions_in_datasets,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    name: str,
    *,
    client: Union[AuthenticatedClient, Client],
    data_type: Union[None, Unset, str] = UNSET,
    show_only_dimensions_in_datasets: Union[Unset, bool] = False,
) -> Optional[Union[HTTPError, HTTPValidationError, List["DimensionIdentifiers"]]]:
    """Get Dimension Type Identifiers

    Args:
        name (str):
        data_type (Union[None, Unset, str]):
        show_only_dimensions_in_datasets (Union[Unset, bool]):  Default: False.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[HTTPError, HTTPValidationError, List['DimensionIdentifiers']]
    """

    return (
        await asyncio_detailed(
            name=name,
            client=client,
            data_type=data_type,
            show_only_dimensions_in_datasets=show_only_dimensions_in_datasets,
        )
    ).parsed
