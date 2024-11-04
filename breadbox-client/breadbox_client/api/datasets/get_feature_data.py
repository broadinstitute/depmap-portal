from http import HTTPStatus
from typing import Any, Dict, List, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.feature_response import FeatureResponse
from ...models.http_error import HTTPError
from ...models.http_validation_error import HTTPValidationError
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    dataset_ids: Union[Unset, List[str]] = UNSET,
    feature_ids: Union[Unset, List[str]] = UNSET,
) -> Dict[str, Any]:
    params: Dict[str, Any] = {}

    json_dataset_ids: Union[Unset, List[str]] = UNSET
    if not isinstance(dataset_ids, Unset):
        json_dataset_ids = dataset_ids

    params["dataset_ids"] = json_dataset_ids

    json_feature_ids: Union[Unset, List[str]] = UNSET
    if not isinstance(feature_ids, Unset):
        json_feature_ids = feature_ids

    params["feature_ids"] = json_feature_ids

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: Dict[str, Any] = {
        "method": "get",
        "url": "/datasets/features/data/",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[HTTPError, HTTPValidationError, List["FeatureResponse"]]]:
    if response.status_code == HTTPStatus.OK:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in _response_200:
            response_200_item = FeatureResponse.from_dict(response_200_item_data)

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
) -> Response[Union[HTTPError, HTTPValidationError, List["FeatureResponse"]]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: Union[AuthenticatedClient, Client],
    dataset_ids: Union[Unset, List[str]] = UNSET,
    feature_ids: Union[Unset, List[str]] = UNSET,
) -> Response[Union[HTTPError, HTTPValidationError, List["FeatureResponse"]]]:
    """Get Feature Data

     Load data for each of the given dataset_id, feature_id pairs.
    This differs from the /get-features endpoint in the type of ID it
    accepts as input and the format of the response. This endpoint also
    does not do any filtering or grouping of feature values.

    Args:
        dataset_ids (Union[Unset, List[str]]): dataset UUIDs specifying which dataset contains
            each given feature
        feature_ids (Union[Unset, List[str]]): natural keys specifying the features for which data
            should be retrieved

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[HTTPError, HTTPValidationError, List['FeatureResponse']]]
    """

    kwargs = _get_kwargs(
        dataset_ids=dataset_ids,
        feature_ids=feature_ids,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: Union[AuthenticatedClient, Client],
    dataset_ids: Union[Unset, List[str]] = UNSET,
    feature_ids: Union[Unset, List[str]] = UNSET,
) -> Optional[Union[HTTPError, HTTPValidationError, List["FeatureResponse"]]]:
    """Get Feature Data

     Load data for each of the given dataset_id, feature_id pairs.
    This differs from the /get-features endpoint in the type of ID it
    accepts as input and the format of the response. This endpoint also
    does not do any filtering or grouping of feature values.

    Args:
        dataset_ids (Union[Unset, List[str]]): dataset UUIDs specifying which dataset contains
            each given feature
        feature_ids (Union[Unset, List[str]]): natural keys specifying the features for which data
            should be retrieved

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[HTTPError, HTTPValidationError, List['FeatureResponse']]
    """

    return sync_detailed(
        client=client,
        dataset_ids=dataset_ids,
        feature_ids=feature_ids,
    ).parsed


async def asyncio_detailed(
    *,
    client: Union[AuthenticatedClient, Client],
    dataset_ids: Union[Unset, List[str]] = UNSET,
    feature_ids: Union[Unset, List[str]] = UNSET,
) -> Response[Union[HTTPError, HTTPValidationError, List["FeatureResponse"]]]:
    """Get Feature Data

     Load data for each of the given dataset_id, feature_id pairs.
    This differs from the /get-features endpoint in the type of ID it
    accepts as input and the format of the response. This endpoint also
    does not do any filtering or grouping of feature values.

    Args:
        dataset_ids (Union[Unset, List[str]]): dataset UUIDs specifying which dataset contains
            each given feature
        feature_ids (Union[Unset, List[str]]): natural keys specifying the features for which data
            should be retrieved

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[HTTPError, HTTPValidationError, List['FeatureResponse']]]
    """

    kwargs = _get_kwargs(
        dataset_ids=dataset_ids,
        feature_ids=feature_ids,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: Union[AuthenticatedClient, Client],
    dataset_ids: Union[Unset, List[str]] = UNSET,
    feature_ids: Union[Unset, List[str]] = UNSET,
) -> Optional[Union[HTTPError, HTTPValidationError, List["FeatureResponse"]]]:
    """Get Feature Data

     Load data for each of the given dataset_id, feature_id pairs.
    This differs from the /get-features endpoint in the type of ID it
    accepts as input and the format of the response. This endpoint also
    does not do any filtering or grouping of feature values.

    Args:
        dataset_ids (Union[Unset, List[str]]): dataset UUIDs specifying which dataset contains
            each given feature
        feature_ids (Union[Unset, List[str]]): natural keys specifying the features for which data
            should be retrieved

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[HTTPError, HTTPValidationError, List['FeatureResponse']]
    """

    return (
        await asyncio_detailed(
            client=client,
            dataset_ids=dataset_ids,
            feature_ids=feature_ids,
        )
    ).parsed
