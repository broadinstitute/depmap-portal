from http import HTTPStatus
from typing import Any, Dict, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.add_dataset_response import AddDatasetResponse
from ...models.http_error import HTTPError
from ...models.http_validation_error import HTTPValidationError
from ...models.matrix_dataset_params import MatrixDatasetParams
from ...models.table_dataset_params import TableDatasetParams
from ...types import Response


def _get_kwargs(
    *,
    body: Union["MatrixDatasetParams", "TableDatasetParams"],
) -> Dict[str, Any]:
    headers: Dict[str, Any] = {}

    _kwargs: Dict[str, Any] = {
        "method": "post",
        "url": "/dataset-v2/",
    }

    _body: Dict[str, Any]
    if isinstance(body, MatrixDatasetParams):
        _body = body.to_dict()
    else:
        _body = body.to_dict()

    _kwargs["json"] = _body
    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[AddDatasetResponse, HTTPError, HTTPValidationError]]:
    if response.status_code == HTTPStatus.ACCEPTED:
        response_202 = AddDatasetResponse.from_dict(response.json())

        return response_202
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
    body: Union["MatrixDatasetParams", "TableDatasetParams"],
) -> Response[Union[AddDatasetResponse, HTTPError, HTTPValidationError]]:
    """Add Dataset Uploads

     Create a new dataset.

    `name`: Name of dataset

    `file_ids`: Ordered list of file ids from the chunked dataset uploads

    `dataset_md5`: md5 hash for entire dataset file

    `data_type`: Data type grouping for your dataset

    `group_id`: ID of the group the dataset belongs to. Required for non-transient datasets.

    `given_id`: Stable human-readable identifier that the portal uses to look up specific datasets.

    `priority`: Numeric value assigned to the dataset with `1` being highest priority within the
    `data_type`, used for displaying order of datasets to show for a specific `data_type` in UI.

    `taiga_id`: Taiga ID the dataset is sourced from.

    `is_transient`: Transient datasets can be deleted - should only be set to true for non-public short-
    term-use datasets like custom analysis results.

    `dataset_metadata`: Contains a dictionary of additional dataset values that are not already provided
    above.

    For matrix dataset format:

    `units`: Units for the values in the dataset, used for display

    `feature_type`: Type of features your dataset contains

    `sample_type`: Type of samples your dataset contains

    `value_type`: Value 'continuous' if dataset contains numerical values or 'categorical' if dataset
    contains string categories as values.

    `allowed_values`: Only provide if 'value_type' is 'categorical'. Must contain all possible
    categorical values

    For table dataset format:

    `index_type`: Feature type or sample type name that is used as index in the table dataset format.
    Used to validate the identifier of the dimension type is included in the dataset.

    `columns_metadata`: List of objects containing info about each column in the table dataset format.

        - `units`: Units for the values in the column, used for display
        - `col_type`: Annotation type for the column. Annotation types may include: `continuous`,
    `categorical`, `binary`, `text`, or `list_strings`

    Args:
        body (Union['MatrixDatasetParams', 'TableDatasetParams']):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[AddDatasetResponse, HTTPError, HTTPValidationError]]
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
    body: Union["MatrixDatasetParams", "TableDatasetParams"],
) -> Optional[Union[AddDatasetResponse, HTTPError, HTTPValidationError]]:
    """Add Dataset Uploads

     Create a new dataset.

    `name`: Name of dataset

    `file_ids`: Ordered list of file ids from the chunked dataset uploads

    `dataset_md5`: md5 hash for entire dataset file

    `data_type`: Data type grouping for your dataset

    `group_id`: ID of the group the dataset belongs to. Required for non-transient datasets.

    `given_id`: Stable human-readable identifier that the portal uses to look up specific datasets.

    `priority`: Numeric value assigned to the dataset with `1` being highest priority within the
    `data_type`, used for displaying order of datasets to show for a specific `data_type` in UI.

    `taiga_id`: Taiga ID the dataset is sourced from.

    `is_transient`: Transient datasets can be deleted - should only be set to true for non-public short-
    term-use datasets like custom analysis results.

    `dataset_metadata`: Contains a dictionary of additional dataset values that are not already provided
    above.

    For matrix dataset format:

    `units`: Units for the values in the dataset, used for display

    `feature_type`: Type of features your dataset contains

    `sample_type`: Type of samples your dataset contains

    `value_type`: Value 'continuous' if dataset contains numerical values or 'categorical' if dataset
    contains string categories as values.

    `allowed_values`: Only provide if 'value_type' is 'categorical'. Must contain all possible
    categorical values

    For table dataset format:

    `index_type`: Feature type or sample type name that is used as index in the table dataset format.
    Used to validate the identifier of the dimension type is included in the dataset.

    `columns_metadata`: List of objects containing info about each column in the table dataset format.

        - `units`: Units for the values in the column, used for display
        - `col_type`: Annotation type for the column. Annotation types may include: `continuous`,
    `categorical`, `binary`, `text`, or `list_strings`

    Args:
        body (Union['MatrixDatasetParams', 'TableDatasetParams']):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[AddDatasetResponse, HTTPError, HTTPValidationError]
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: Union[AuthenticatedClient, Client],
    body: Union["MatrixDatasetParams", "TableDatasetParams"],
) -> Response[Union[AddDatasetResponse, HTTPError, HTTPValidationError]]:
    """Add Dataset Uploads

     Create a new dataset.

    `name`: Name of dataset

    `file_ids`: Ordered list of file ids from the chunked dataset uploads

    `dataset_md5`: md5 hash for entire dataset file

    `data_type`: Data type grouping for your dataset

    `group_id`: ID of the group the dataset belongs to. Required for non-transient datasets.

    `given_id`: Stable human-readable identifier that the portal uses to look up specific datasets.

    `priority`: Numeric value assigned to the dataset with `1` being highest priority within the
    `data_type`, used for displaying order of datasets to show for a specific `data_type` in UI.

    `taiga_id`: Taiga ID the dataset is sourced from.

    `is_transient`: Transient datasets can be deleted - should only be set to true for non-public short-
    term-use datasets like custom analysis results.

    `dataset_metadata`: Contains a dictionary of additional dataset values that are not already provided
    above.

    For matrix dataset format:

    `units`: Units for the values in the dataset, used for display

    `feature_type`: Type of features your dataset contains

    `sample_type`: Type of samples your dataset contains

    `value_type`: Value 'continuous' if dataset contains numerical values or 'categorical' if dataset
    contains string categories as values.

    `allowed_values`: Only provide if 'value_type' is 'categorical'. Must contain all possible
    categorical values

    For table dataset format:

    `index_type`: Feature type or sample type name that is used as index in the table dataset format.
    Used to validate the identifier of the dimension type is included in the dataset.

    `columns_metadata`: List of objects containing info about each column in the table dataset format.

        - `units`: Units for the values in the column, used for display
        - `col_type`: Annotation type for the column. Annotation types may include: `continuous`,
    `categorical`, `binary`, `text`, or `list_strings`

    Args:
        body (Union['MatrixDatasetParams', 'TableDatasetParams']):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[AddDatasetResponse, HTTPError, HTTPValidationError]]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: Union[AuthenticatedClient, Client],
    body: Union["MatrixDatasetParams", "TableDatasetParams"],
) -> Optional[Union[AddDatasetResponse, HTTPError, HTTPValidationError]]:
    """Add Dataset Uploads

     Create a new dataset.

    `name`: Name of dataset

    `file_ids`: Ordered list of file ids from the chunked dataset uploads

    `dataset_md5`: md5 hash for entire dataset file

    `data_type`: Data type grouping for your dataset

    `group_id`: ID of the group the dataset belongs to. Required for non-transient datasets.

    `given_id`: Stable human-readable identifier that the portal uses to look up specific datasets.

    `priority`: Numeric value assigned to the dataset with `1` being highest priority within the
    `data_type`, used for displaying order of datasets to show for a specific `data_type` in UI.

    `taiga_id`: Taiga ID the dataset is sourced from.

    `is_transient`: Transient datasets can be deleted - should only be set to true for non-public short-
    term-use datasets like custom analysis results.

    `dataset_metadata`: Contains a dictionary of additional dataset values that are not already provided
    above.

    For matrix dataset format:

    `units`: Units for the values in the dataset, used for display

    `feature_type`: Type of features your dataset contains

    `sample_type`: Type of samples your dataset contains

    `value_type`: Value 'continuous' if dataset contains numerical values or 'categorical' if dataset
    contains string categories as values.

    `allowed_values`: Only provide if 'value_type' is 'categorical'. Must contain all possible
    categorical values

    For table dataset format:

    `index_type`: Feature type or sample type name that is used as index in the table dataset format.
    Used to validate the identifier of the dimension type is included in the dataset.

    `columns_metadata`: List of objects containing info about each column in the table dataset format.

        - `units`: Units for the values in the column, used for display
        - `col_type`: Annotation type for the column. Annotation types may include: `continuous`,
    `categorical`, `binary`, `text`, or `list_strings`

    Args:
        body (Union['MatrixDatasetParams', 'TableDatasetParams']):

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
        )
    ).parsed
