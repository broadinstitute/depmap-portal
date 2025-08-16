from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.encoders import jsonable_encoder
from breadbox.compute.dataset_uploads_tasks import run_dataset_upload
from ..schemas.custom_http_exception import UserError

from ..schemas.dataset import DatasetParams, AddDatasetResponse
from .dependencies import get_user

from ..celery_task import utils

router = APIRouter(prefix="/dataset-v2", tags=["datasets"])


@router.post(
    "/",
    operation_id="add_dataset_uploads",
    response_model=AddDatasetResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def add_dataset_uploads(
    dataset: DatasetParams, user: str = Depends(get_user),
):
    """
    Create a new dataset.

    `name`: Name of dataset

    `file_ids`: Ordered list of file ids from the chunked dataset uploads

    `dataset_md5`: md5 hash for entire dataset file

    `data_type`: Data type grouping for your dataset

    `group_id`: ID of the group the dataset belongs to. Required for non-transient datasets.

    `given_id`: Stable human-readable identifier that the portal uses to look up specific datasets.

    `priority`: Numeric value assigned to the dataset with `1` being highest priority within the `data_type`, used for displaying order of datasets to show for a specific `data_type` in UI.

    `taiga_id`: Taiga ID the dataset is sourced from.

    `is_transient`: Transient datasets can be deleted - should only be set to true for non-public short-term-use datasets like custom analysis results.

    `dataset_metadata`: Contains a dictionary of additional dataset values that are not already provided above.

    For matrix dataset format:

    `units`: Units for the values in the dataset, used for display

    `feature_type`: Type of features your dataset contains

    `sample_type`: Type of samples your dataset contains

    `value_type`: Value 'continuous' if dataset contains numerical values or 'categorical' if dataset contains string categories as values.

    `allowed_values`: Only provide if 'value_type' is 'categorical'. Must contain all possible categorical values

    For table dataset format:

    `index_type`: Feature type or sample type name that is used as index in the table dataset format. Used to validate the identifier of the dimension type is included in the dataset.

    `columns_metadata`: List of objects containing info about each column in the table dataset format.

        - `units`: Units for the values in the column, used for display
        - `col_type`: Annotation type for the column. Annotation types may include: `continuous`, `categorical`, `text`, or `list_strings`

    """
    utils.check_celery()

    if not dataset.is_transient and dataset.expiry_in_seconds is not None:
        raise UserError(
            "Dataset was not marked as 'transient' but expiry_in_seconds is set."
        )

    # Converts a data type (like a Pydantic model) to something compatible with JSON, in this case a dict. Although Celery uses a JSON serializer to serialize arguments to tasks by default, pydantic models are too complex for their default serializer. Pydantic models have a built-in .dict() method but it turns out it doesn't convert enums to strings which celery can't JSON serialize, so I opted to use fastapi's jsonable_encoder() which appears to successfully json serialize enums
    dataset_json = jsonable_encoder(dataset)
    result = run_dataset_upload.delay(dataset_json, user)  # pyright: ignore

    task_status = utils.format_task_status(result)
    return task_status
