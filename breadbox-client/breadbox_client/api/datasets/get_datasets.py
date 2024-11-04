from http import HTTPStatus
from typing import Any, Dict, List, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.http_error import HTTPError
from ...models.http_validation_error import HTTPValidationError
from ...models.matrix_dataset_response import MatrixDatasetResponse
from ...models.tabular_dataset_response import TabularDatasetResponse
from ...models.value_type import ValueType
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    feature_id: Union[None, Unset, str] = UNSET,
    feature_type: Union[None, Unset, str] = UNSET,
    sample_id: Union[None, Unset, str] = UNSET,
    sample_type: Union[None, Unset, str] = UNSET,
    value_type: Union[None, Unset, ValueType] = UNSET,
) -> Dict[str, Any]:
    params: Dict[str, Any] = {}

    json_feature_id: Union[None, Unset, str]
    if isinstance(feature_id, Unset):
        json_feature_id = UNSET
    else:
        json_feature_id = feature_id
    params["feature_id"] = json_feature_id

    json_feature_type: Union[None, Unset, str]
    if isinstance(feature_type, Unset):
        json_feature_type = UNSET
    else:
        json_feature_type = feature_type
    params["feature_type"] = json_feature_type

    json_sample_id: Union[None, Unset, str]
    if isinstance(sample_id, Unset):
        json_sample_id = UNSET
    else:
        json_sample_id = sample_id
    params["sample_id"] = json_sample_id

    json_sample_type: Union[None, Unset, str]
    if isinstance(sample_type, Unset):
        json_sample_type = UNSET
    else:
        json_sample_type = sample_type
    params["sample_type"] = json_sample_type

    json_value_type: Union[None, Unset, str]
    if isinstance(value_type, Unset):
        json_value_type = UNSET
    elif isinstance(value_type, ValueType):
        json_value_type = value_type.value
    else:
        json_value_type = value_type
    params["value_type"] = json_value_type

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: Dict[str, Any] = {
        "method": "get",
        "url": "/datasets/",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[
    Union[
        HTTPError,
        HTTPValidationError,
        List[Union["MatrixDatasetResponse", "TabularDatasetResponse"]],
    ]
]:
    if response.status_code == HTTPStatus.OK:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in _response_200:

            def _parse_response_200_item(
                data: object,
            ) -> Union["MatrixDatasetResponse", "TabularDatasetResponse"]:
                try:
                    if not isinstance(data, dict):
                        raise TypeError()
                    response_200_item_type_0 = MatrixDatasetResponse.from_dict(data)

                    return response_200_item_type_0
                except:  # noqa: E722
                    pass
                if not isinstance(data, dict):
                    raise TypeError()
                response_200_item_type_1 = TabularDatasetResponse.from_dict(data)

                return response_200_item_type_1

            response_200_item = _parse_response_200_item(response_200_item_data)

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
    Union[
        HTTPError,
        HTTPValidationError,
        List[Union["MatrixDatasetResponse", "TabularDatasetResponse"]],
    ]
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
    feature_id: Union[None, Unset, str] = UNSET,
    feature_type: Union[None, Unset, str] = UNSET,
    sample_id: Union[None, Unset, str] = UNSET,
    sample_type: Union[None, Unset, str] = UNSET,
    value_type: Union[None, Unset, ValueType] = UNSET,
) -> Response[
    Union[
        HTTPError,
        HTTPValidationError,
        List[Union["MatrixDatasetResponse", "TabularDatasetResponse"]],
    ]
]:
    """Get Datasets

     Get metadata for all datasets available to current user.

    If `feature_id` and `feature_type` are specified, we return only the datasets that contain that
    feature.

    If `feature_type` is specified without `feature_id`, then we return the datasets
    that have that `feature_type`.

    Similar for `sample_id` and `sample_type`.

    Args:
        feature_id (Union[None, Unset, str]):
        feature_type (Union[None, Unset, str]):
        sample_id (Union[None, Unset, str]):
        sample_type (Union[None, Unset, str]):
        value_type (Union[None, Unset, ValueType]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[HTTPError, HTTPValidationError, List[Union['MatrixDatasetResponse', 'TabularDatasetResponse']]]]
    """

    kwargs = _get_kwargs(
        feature_id=feature_id,
        feature_type=feature_type,
        sample_id=sample_id,
        sample_type=sample_type,
        value_type=value_type,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: Union[AuthenticatedClient, Client],
    feature_id: Union[None, Unset, str] = UNSET,
    feature_type: Union[None, Unset, str] = UNSET,
    sample_id: Union[None, Unset, str] = UNSET,
    sample_type: Union[None, Unset, str] = UNSET,
    value_type: Union[None, Unset, ValueType] = UNSET,
) -> Optional[
    Union[
        HTTPError,
        HTTPValidationError,
        List[Union["MatrixDatasetResponse", "TabularDatasetResponse"]],
    ]
]:
    """Get Datasets

     Get metadata for all datasets available to current user.

    If `feature_id` and `feature_type` are specified, we return only the datasets that contain that
    feature.

    If `feature_type` is specified without `feature_id`, then we return the datasets
    that have that `feature_type`.

    Similar for `sample_id` and `sample_type`.

    Args:
        feature_id (Union[None, Unset, str]):
        feature_type (Union[None, Unset, str]):
        sample_id (Union[None, Unset, str]):
        sample_type (Union[None, Unset, str]):
        value_type (Union[None, Unset, ValueType]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[HTTPError, HTTPValidationError, List[Union['MatrixDatasetResponse', 'TabularDatasetResponse']]]
    """

    return sync_detailed(
        client=client,
        feature_id=feature_id,
        feature_type=feature_type,
        sample_id=sample_id,
        sample_type=sample_type,
        value_type=value_type,
    ).parsed


async def asyncio_detailed(
    *,
    client: Union[AuthenticatedClient, Client],
    feature_id: Union[None, Unset, str] = UNSET,
    feature_type: Union[None, Unset, str] = UNSET,
    sample_id: Union[None, Unset, str] = UNSET,
    sample_type: Union[None, Unset, str] = UNSET,
    value_type: Union[None, Unset, ValueType] = UNSET,
) -> Response[
    Union[
        HTTPError,
        HTTPValidationError,
        List[Union["MatrixDatasetResponse", "TabularDatasetResponse"]],
    ]
]:
    """Get Datasets

     Get metadata for all datasets available to current user.

    If `feature_id` and `feature_type` are specified, we return only the datasets that contain that
    feature.

    If `feature_type` is specified without `feature_id`, then we return the datasets
    that have that `feature_type`.

    Similar for `sample_id` and `sample_type`.

    Args:
        feature_id (Union[None, Unset, str]):
        feature_type (Union[None, Unset, str]):
        sample_id (Union[None, Unset, str]):
        sample_type (Union[None, Unset, str]):
        value_type (Union[None, Unset, ValueType]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[HTTPError, HTTPValidationError, List[Union['MatrixDatasetResponse', 'TabularDatasetResponse']]]]
    """

    kwargs = _get_kwargs(
        feature_id=feature_id,
        feature_type=feature_type,
        sample_id=sample_id,
        sample_type=sample_type,
        value_type=value_type,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: Union[AuthenticatedClient, Client],
    feature_id: Union[None, Unset, str] = UNSET,
    feature_type: Union[None, Unset, str] = UNSET,
    sample_id: Union[None, Unset, str] = UNSET,
    sample_type: Union[None, Unset, str] = UNSET,
    value_type: Union[None, Unset, ValueType] = UNSET,
) -> Optional[
    Union[
        HTTPError,
        HTTPValidationError,
        List[Union["MatrixDatasetResponse", "TabularDatasetResponse"]],
    ]
]:
    """Get Datasets

     Get metadata for all datasets available to current user.

    If `feature_id` and `feature_type` are specified, we return only the datasets that contain that
    feature.

    If `feature_type` is specified without `feature_id`, then we return the datasets
    that have that `feature_type`.

    Similar for `sample_id` and `sample_type`.

    Args:
        feature_id (Union[None, Unset, str]):
        feature_type (Union[None, Unset, str]):
        sample_id (Union[None, Unset, str]):
        sample_type (Union[None, Unset, str]):
        value_type (Union[None, Unset, ValueType]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[HTTPError, HTTPValidationError, List[Union['MatrixDatasetResponse', 'TabularDatasetResponse']]]
    """

    return (
        await asyncio_detailed(
            client=client,
            feature_id=feature_id,
            feature_type=feature_type,
            sample_id=sample_id,
            sample_type=sample_type,
            value_type=value_type,
        )
    ).parsed
