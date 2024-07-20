from http import HTTPStatus
from typing import Any, Dict, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.body_update_dataset import BodyUpdateDataset
from ...models.http_error import HTTPError
from ...models.http_validation_error import HTTPValidationError
from ...models.matrix_dataset_response import MatrixDatasetResponse
from ...models.tabular_dataset_response import TabularDatasetResponse
from ...types import Response


def _get_kwargs(
    dataset_id: str,
    *,
    body: BodyUpdateDataset,
) -> Dict[str, Any]:
    headers: Dict[str, Any] = {}

    _kwargs: Dict[str, Any] = {
        "method": "patch",
        "url": "/datasets/{dataset_id}".format(
            dataset_id=dataset_id,
        ),
    }

    _body = body.to_dict()

    _kwargs["data"] = _body
    headers["Content-Type"] = "application/x-www-form-urlencoded"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[
    Union[
        HTTPError,
        HTTPValidationError,
        Union["MatrixDatasetResponse", "TabularDatasetResponse"],
    ]
]:
    if response.status_code == HTTPStatus.OK:

        def _parse_response_200(
            data: object,
        ) -> Union["MatrixDatasetResponse", "TabularDatasetResponse"]:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                response_200_type_0 = MatrixDatasetResponse.from_dict(data)

                return response_200_type_0
            except:  # noqa: E722
                pass
            if not isinstance(data, dict):
                raise TypeError()
            response_200_type_1 = TabularDatasetResponse.from_dict(data)

            return response_200_type_1

        response_200 = _parse_response_200(response.json())

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
    Union[
        HTTPError,
        HTTPValidationError,
        Union["MatrixDatasetResponse", "TabularDatasetResponse"],
    ]
]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    dataset_id: str,
    *,
    client: Union[AuthenticatedClient, Client],
    body: BodyUpdateDataset,
) -> Response[
    Union[
        HTTPError,
        HTTPValidationError,
        Union["MatrixDatasetResponse", "TabularDatasetResponse"],
    ]
]:
    """Update Dataset

    Args:
        dataset_id (str):
        body (BodyUpdateDataset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[HTTPError, HTTPValidationError, Union['MatrixDatasetResponse', 'TabularDatasetResponse']]]
    """

    kwargs = _get_kwargs(
        dataset_id=dataset_id,
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    dataset_id: str,
    *,
    client: Union[AuthenticatedClient, Client],
    body: BodyUpdateDataset,
) -> Optional[
    Union[
        HTTPError,
        HTTPValidationError,
        Union["MatrixDatasetResponse", "TabularDatasetResponse"],
    ]
]:
    """Update Dataset

    Args:
        dataset_id (str):
        body (BodyUpdateDataset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[HTTPError, HTTPValidationError, Union['MatrixDatasetResponse', 'TabularDatasetResponse']]
    """

    return sync_detailed(
        dataset_id=dataset_id,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    dataset_id: str,
    *,
    client: Union[AuthenticatedClient, Client],
    body: BodyUpdateDataset,
) -> Response[
    Union[
        HTTPError,
        HTTPValidationError,
        Union["MatrixDatasetResponse", "TabularDatasetResponse"],
    ]
]:
    """Update Dataset

    Args:
        dataset_id (str):
        body (BodyUpdateDataset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[HTTPError, HTTPValidationError, Union['MatrixDatasetResponse', 'TabularDatasetResponse']]]
    """

    kwargs = _get_kwargs(
        dataset_id=dataset_id,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    dataset_id: str,
    *,
    client: Union[AuthenticatedClient, Client],
    body: BodyUpdateDataset,
) -> Optional[
    Union[
        HTTPError,
        HTTPValidationError,
        Union["MatrixDatasetResponse", "TabularDatasetResponse"],
    ]
]:
    """Update Dataset

    Args:
        dataset_id (str):
        body (BodyUpdateDataset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[HTTPError, HTTPValidationError, Union['MatrixDatasetResponse', 'TabularDatasetResponse']]
    """

    return (
        await asyncio_detailed(
            dataset_id=dataset_id,
            client=client,
            body=body,
        )
    ).parsed
