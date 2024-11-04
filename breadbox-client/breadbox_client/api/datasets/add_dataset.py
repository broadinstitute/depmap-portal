from http import HTTPStatus
from typing import Any, Dict, List, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.add_dataset_response import AddDatasetResponse
from ...models.body_add_dataset import BodyAddDataset
from ...models.http_error import HTTPError
from ...models.http_validation_error import HTTPValidationError
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    body: BodyAddDataset,
    allowed_values: Union[Unset, List[str]] = UNSET,
) -> Dict[str, Any]:
    headers: Dict[str, Any] = {}

    params: Dict[str, Any] = {}

    json_allowed_values: Union[Unset, List[str]] = UNSET
    if not isinstance(allowed_values, Unset):
        json_allowed_values = allowed_values

    params["allowed_values"] = json_allowed_values

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: Dict[str, Any] = {
        "method": "post",
        "url": "/datasets/",
        "params": params,
    }

    _body = body.to_multipart()

    _kwargs["files"] = _body

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[AddDatasetResponse, HTTPError, HTTPValidationError]]:
    if response.status_code == HTTPStatus.OK:
        response_200 = AddDatasetResponse.from_dict(response.json())

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
) -> Response[Union[AddDatasetResponse, HTTPError, HTTPValidationError]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: Union[AuthenticatedClient, Client],
    body: BodyAddDataset,
    allowed_values: Union[Unset, List[str]] = UNSET,
) -> Response[Union[AddDatasetResponse, HTTPError, HTTPValidationError]]:
    """Add Dataset

     Create a new dataset.

    Args:
        allowed_values (Union[Unset, List[str]]): Only provide if 'value_type' is 'categorical'.
            Must contain all possible categorical values
        body (BodyAddDataset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[AddDatasetResponse, HTTPError, HTTPValidationError]]
    """

    kwargs = _get_kwargs(
        body=body,
        allowed_values=allowed_values,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: Union[AuthenticatedClient, Client],
    body: BodyAddDataset,
    allowed_values: Union[Unset, List[str]] = UNSET,
) -> Optional[Union[AddDatasetResponse, HTTPError, HTTPValidationError]]:
    """Add Dataset

     Create a new dataset.

    Args:
        allowed_values (Union[Unset, List[str]]): Only provide if 'value_type' is 'categorical'.
            Must contain all possible categorical values
        body (BodyAddDataset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[AddDatasetResponse, HTTPError, HTTPValidationError]
    """

    return sync_detailed(
        client=client,
        body=body,
        allowed_values=allowed_values,
    ).parsed


async def asyncio_detailed(
    *,
    client: Union[AuthenticatedClient, Client],
    body: BodyAddDataset,
    allowed_values: Union[Unset, List[str]] = UNSET,
) -> Response[Union[AddDatasetResponse, HTTPError, HTTPValidationError]]:
    """Add Dataset

     Create a new dataset.

    Args:
        allowed_values (Union[Unset, List[str]]): Only provide if 'value_type' is 'categorical'.
            Must contain all possible categorical values
        body (BodyAddDataset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[AddDatasetResponse, HTTPError, HTTPValidationError]]
    """

    kwargs = _get_kwargs(
        body=body,
        allowed_values=allowed_values,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: Union[AuthenticatedClient, Client],
    body: BodyAddDataset,
    allowed_values: Union[Unset, List[str]] = UNSET,
) -> Optional[Union[AddDatasetResponse, HTTPError, HTTPValidationError]]:
    """Add Dataset

     Create a new dataset.

    Args:
        allowed_values (Union[Unset, List[str]]): Only provide if 'value_type' is 'categorical'.
            Must contain all possible categorical values
        body (BodyAddDataset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[AddDatasetResponse, HTTPError, HTTPValidationError]
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
            allowed_values=allowed_values,
        )
    ).parsed
