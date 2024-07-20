from http import HTTPStatus
from typing import Any, Dict, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.feature_validation_query import FeatureValidationQuery
from ...models.http_error import HTTPError
from ...models.http_validation_error import HTTPValidationError
from ...models.validate_data_slicer_features_downloads_data_slicer_validate_data_slicer_features_post_response_validate_data_slicer_features_downloads_data_slicer_validate_data_slicer_features_post import (
    ValidateDataSlicerFeaturesDownloadsDataSlicerValidateDataSlicerFeaturesPostResponseValidateDataSlicerFeaturesDownloadsDataSlicerValidateDataSlicerFeaturesPost,
)
from ...types import Response


def _get_kwargs(
    *,
    body: FeatureValidationQuery,
) -> Dict[str, Any]:
    headers: Dict[str, Any] = {}

    _kwargs: Dict[str, Any] = {
        "method": "post",
        "url": "/downloads/data_slicer/validate_data_slicer_features",
    }

    _body = body.to_dict()

    _kwargs["json"] = _body
    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[
    Union[
        HTTPError,
        HTTPValidationError,
        ValidateDataSlicerFeaturesDownloadsDataSlicerValidateDataSlicerFeaturesPostResponseValidateDataSlicerFeaturesDownloadsDataSlicerValidateDataSlicerFeaturesPost,
    ]
]:
    if response.status_code == HTTPStatus.OK:
        response_200 = ValidateDataSlicerFeaturesDownloadsDataSlicerValidateDataSlicerFeaturesPostResponseValidateDataSlicerFeaturesDownloadsDataSlicerValidateDataSlicerFeaturesPost.from_dict(
            response.json()
        )

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
        ValidateDataSlicerFeaturesDownloadsDataSlicerValidateDataSlicerFeaturesPostResponseValidateDataSlicerFeaturesDownloadsDataSlicerValidateDataSlicerFeaturesPost,
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
    body: FeatureValidationQuery,
) -> Response[
    Union[
        HTTPError,
        HTTPValidationError,
        ValidateDataSlicerFeaturesDownloadsDataSlicerValidateDataSlicerFeaturesPostResponseValidateDataSlicerFeaturesDownloadsDataSlicerValidateDataSlicerFeaturesPost,
    ]
]:
    r"""Validate Data Slicer Features

     From the given list of feature_labels, determine which are valid metadata labels
    in any dataset (case-insensitive). Return lists of both valid and invalid labels.

    Warning: For simplicity's sake, this is only returning metadata labels as \"valid\".
    If we want this to work for datasets that don't have metadata (that use their given ids as labels),
    we'll need to make some changes to the implementation of this endpoint.

    Args:
        body (FeatureValidationQuery):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[HTTPError, HTTPValidationError, ValidateDataSlicerFeaturesDownloadsDataSlicerValidateDataSlicerFeaturesPostResponseValidateDataSlicerFeaturesDownloadsDataSlicerValidateDataSlicerFeaturesPost]]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: Union[AuthenticatedClient, Client],
    body: FeatureValidationQuery,
) -> Optional[
    Union[
        HTTPError,
        HTTPValidationError,
        ValidateDataSlicerFeaturesDownloadsDataSlicerValidateDataSlicerFeaturesPostResponseValidateDataSlicerFeaturesDownloadsDataSlicerValidateDataSlicerFeaturesPost,
    ]
]:
    r"""Validate Data Slicer Features

     From the given list of feature_labels, determine which are valid metadata labels
    in any dataset (case-insensitive). Return lists of both valid and invalid labels.

    Warning: For simplicity's sake, this is only returning metadata labels as \"valid\".
    If we want this to work for datasets that don't have metadata (that use their given ids as labels),
    we'll need to make some changes to the implementation of this endpoint.

    Args:
        body (FeatureValidationQuery):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[HTTPError, HTTPValidationError, ValidateDataSlicerFeaturesDownloadsDataSlicerValidateDataSlicerFeaturesPostResponseValidateDataSlicerFeaturesDownloadsDataSlicerValidateDataSlicerFeaturesPost]
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: Union[AuthenticatedClient, Client],
    body: FeatureValidationQuery,
) -> Response[
    Union[
        HTTPError,
        HTTPValidationError,
        ValidateDataSlicerFeaturesDownloadsDataSlicerValidateDataSlicerFeaturesPostResponseValidateDataSlicerFeaturesDownloadsDataSlicerValidateDataSlicerFeaturesPost,
    ]
]:
    r"""Validate Data Slicer Features

     From the given list of feature_labels, determine which are valid metadata labels
    in any dataset (case-insensitive). Return lists of both valid and invalid labels.

    Warning: For simplicity's sake, this is only returning metadata labels as \"valid\".
    If we want this to work for datasets that don't have metadata (that use their given ids as labels),
    we'll need to make some changes to the implementation of this endpoint.

    Args:
        body (FeatureValidationQuery):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[HTTPError, HTTPValidationError, ValidateDataSlicerFeaturesDownloadsDataSlicerValidateDataSlicerFeaturesPostResponseValidateDataSlicerFeaturesDownloadsDataSlicerValidateDataSlicerFeaturesPost]]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: Union[AuthenticatedClient, Client],
    body: FeatureValidationQuery,
) -> Optional[
    Union[
        HTTPError,
        HTTPValidationError,
        ValidateDataSlicerFeaturesDownloadsDataSlicerValidateDataSlicerFeaturesPostResponseValidateDataSlicerFeaturesDownloadsDataSlicerValidateDataSlicerFeaturesPost,
    ]
]:
    r"""Validate Data Slicer Features

     From the given list of feature_labels, determine which are valid metadata labels
    in any dataset (case-insensitive). Return lists of both valid and invalid labels.

    Warning: For simplicity's sake, this is only returning metadata labels as \"valid\".
    If we want this to work for datasets that don't have metadata (that use their given ids as labels),
    we'll need to make some changes to the implementation of this endpoint.

    Args:
        body (FeatureValidationQuery):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[HTTPError, HTTPValidationError, ValidateDataSlicerFeaturesDownloadsDataSlicerValidateDataSlicerFeaturesPostResponseValidateDataSlicerFeaturesDownloadsDataSlicerValidateDataSlicerFeaturesPost]
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
