from dataclasses import dataclass
import dataclasses
from io import BytesIO
import time
from typing import Any, Callable, Dict, List, Optional, Set, TypedDict, Union, Literal
from logging import getLogger
from uuid import UUID, uuid4
from breadbox.io.upload_utils import create_upload_file

import celery

from fastapi import (
    HTTPException,
    UploadFile,
)
from sqlalchemy import and_

from breadbox.db.session import SessionWithUser
from breadbox.schemas.custom_http_exception import ResourceNotFoundError
from breadbox.models.dataset import (
    DimensionType,
    ValueType,
)
from breadbox.models.data_type import DataType
from breadbox.schemas.dataset import (
    MatrixDatasetIn,
    UploadDatasetResponse,
    DatasetResponse,
)
from ..config import get_settings
from ..service import dataset as dataset_service
from ..crud import dimension_types as type_crud
from ..crud import group as group_crud
from ..crud import data_type as data_type_crud
from ..io.data_validation import validate_and_upload_dataset_files
from .celery import app
from ..db.util import db_context
from breadbox.compute.dataset_uploads_tasks import parse_and_validate_dataset_given_id

log = getLogger(__name__)


# UploadFile objects cannot be passed through redis, so we
# use FileDict instead.
class FileDict(TypedDict):
    stream: str
    filename: str


def get_file_dict(datafile) -> FileDict:
    # The portal backend imposes max file size (for custom uploads) of 11mb, IF current_app.config["ENABLED_FEATURES"].limit_file_size.
    # Can add that here if Breadbox also needs to impose a max size.
    datafile_bytes: bytes = datafile.file.read()
    data_file_dict: FileDict = {
        "stream": datafile_bytes.decode("utf8"),
        "filename": datafile.filename,
    }

    return data_file_dict


# Convert the FileDict back to an UploadFile after it is passed through redis.
# This is a general function used for data_file
def _get_upload_file_from_file_dict(file_dict: FileDict) -> UploadFile:
    file = BytesIO(file_dict["stream"].encode("utf8"))
    upload_file = create_upload_file(
        filename=file_dict["filename"], file=file, content_type="text/csv"
    )

    return upload_file


@dataclass
class ValidatedDatasetFields:
    valid_feature_type: Optional[DimensionType]
    valid_sample_type: DimensionType
    valid_data_type: DataType
    valid_allowed_values: Optional[List[str]]


def _validate_dataset_fields(
    db: SessionWithUser,
    user: str,
    group_id: str,
    data_type_name: str,
    feature_type: Optional[str],
    sample_type: str,
    data_file: UploadFile,
    value_type: ValueType,
    allowed_values: Optional[Set[str]],
):
    # NOTE: We make this check in the dataset_crud.add_dataset function too, because we
    # want to have access checks at the crud layer. But we want to check this before we
    # do any work validating the dataset.
    group = group_crud.get_group(db, user, group_id, write_access=True)
    if group is None:
        if group_crud.get_group(db, user, group_id, write_access=False) is not None:
            raise HTTPException(
                403, "You do not have permissions to add a dataset to this group"
            )
        raise HTTPException(404, detail=f"Group not found: '{group_id}'")

    data_type = data_type_crud.get_data_type(db, data_type_name)
    if data_type is None:
        raise HTTPException(404, f"Data type not found: '{data_type_name}'")

    if feature_type:
        valid_feature_type = type_crud.get_dimension_type(db, feature_type)
        if not valid_feature_type:
            raise ResourceNotFoundError(
                f"Feature type '{feature_type}' does not exist!"
            )

    else:
        valid_feature_type = None

    if sample_type:
        valid_sample_type = type_crud.get_dimension_type(db, sample_type)
        if not valid_sample_type:
            raise ResourceNotFoundError(f"Sample type '{sample_type}' does not exist!")

    else:
        valid_sample_type = None

    # TODO: DELETE below block since it will be in pydantic model validations
    if value_type == ValueType.categorical:
        assert (
            allowed_values
        ), "Allowed values must be specified for categorical datasets."
    else:
        assert (
            allowed_values is None
        ), "Allowed values should not be specified for non-categorical datasets"

    for f, n in [
        (data_file, "data_file"),  # TODO: delete
    ]:
        if f is not None and f.content_type != "text/csv":
            raise HTTPException(
                400,
                detail=f"Invalid document type for '{n}'. Expected 'text/csv/' but got {f.content_type}",
            )

    validated_allowed_values = _get_allowed_values_list(allowed_values)
    return ValidatedDatasetFields(
        valid_feature_type, valid_sample_type, data_type, validated_allowed_values
    )


# TODO: Delete bc check done in pydantic model validator
def _get_allowed_values_list(
    allowed_values: Union[Set[str], None]
) -> Union[List[str], None]:
    if allowed_values is not None:
        allowed_values_list: List = list(
            allowed_values
        )  # convert to list so order preserved
        # Check that no repeats of allowed values since they should be case-insensitive
        allowed_values_list_lower = [str(x).lower() for x in allowed_values_list]
        if len(set(allowed_values_list_lower)) != len(allowed_values):
            raise HTTPException(
                400,
                detail="Make sure there are no repeats in allowed_values. Values are not considered case-sensitive",
            )
    else:
        allowed_values_list = None

    return allowed_values_list


def upload_dataset(
    db: SessionWithUser,
    settings,
    name: str,
    units: str,
    feature_type: Optional[str],
    sample_type: str,
    data_type: str,
    data_file: UploadFile,
    value_type: ValueType,
    priority: Optional[int],
    taiga_id: Optional[str],
    allowed_values: Optional[Set[str]],
    is_transient: bool,
    user: str,
    data_file_format: str,
    *,
    update_message: Optional[Callable[[str], None]] = None,
    group_id: Optional[str] = None,
    given_id: Optional[str] = None,
    dataset_metadata: Optional[Dict[str, Any]] = None,
):
    assert (
        isinstance(dataset_metadata, dict) or dataset_metadata is None
    ), "dataset_metadata is supposed to be a dict"

    if is_transient:
        group_id = group_crud.TRANSIENT_GROUP_ID
    elif group_id is None:
        raise HTTPException(400, "Non-transient dataset must have a group id")

    if sample_type is None and feature_type is None:
        raise HTTPException(
            400, "Dataset sample_type and feature_type cannot both be null."
        )
    parsed_given_id = parse_and_validate_dataset_given_id(
        db=db, dataset_given_id=given_id, dataset_metadata=dataset_metadata
    )

    dataset_id = str(uuid4())

    valid_fields = _validate_dataset_fields(
        db=db,
        user=user,
        group_id=group_id,
        data_type_name=data_type,
        feature_type=feature_type,
        sample_type=sample_type,
        data_file=data_file,
        value_type=value_type,
        allowed_values=allowed_values,
    )

    try:
        (
            feature_given_id_and_index_df,
            sample_given_id_and_index_df,
            feature_warnings,
            sample_warnings,
        ) = dataclasses.astuple(
            validate_and_upload_dataset_files(
                db,
                dataset_id,
                data_file,
                valid_fields.valid_feature_type,
                valid_fields.valid_sample_type,
                settings.filestore_location,
                value_type,
                valid_fields.valid_allowed_values,
                data_file_format=data_file_format,
            )
        )
    except ValueError as e:
        msg = f"Unexpected exception during dataset file validation: {e}"
        log.exception(msg)
        raise HTTPException(400, detail=msg) from e

    dataset = MatrixDatasetIn(
        id=dataset_id,
        name=name,
        units=units,
        feature_type_name=feature_type,
        sample_type_name=sample_type,
        data_type=data_type,
        is_transient=is_transient,
        group_id=group_id,
        value_type=value_type,
        priority=priority,
        taiga_id=taiga_id,
        given_id=parsed_given_id,
        allowed_values=valid_fields.valid_allowed_values,
        dataset_metadata=dataset_metadata,
        dataset_md5=None,
    )

    added_dataset = dataset_service.add_matrix_dataset(
        db,
        user,
        dataset,
        feature_given_id_and_index_df,
        sample_given_id_and_index_df,
        valid_fields.valid_feature_type,
        valid_fields.valid_sample_type,
        short_name=None,
        version=None,
        description=None,
    )

    # NOTE: The return value of dataset_crud.add_dataset can be None if the user
    # doesn't have access to write to the group, but we also check for that at the
    # beginning of this function, so it shouldn't be None here.
    if added_dataset is None:
        raise HTTPException(500)

    warning = ""
    if (len(sample_warnings) != 0) or (len(feature_warnings) != 0):
        if feature_type is None:
            feature_warning = f"Features: {feature_warnings} don't belong to a feature type. Consider creating a feature type for them!"
        else:
            feature_warning = (
                f"Features: {feature_warnings} not in {feature_type} metadata. Consider updating your feature type metadata!"
                if len(feature_warnings)
                else ""
            )
        sample_warning = (
            f"Samples: {sample_warnings} not in {sample_type} metadata. Consider updating your sample type metadata!"
            if len(sample_warnings)
            else ""
        )
        warning = feature_warning + sample_warning

    forwardingUrl = None

    if update_message:
        update_message("Wrapping up upload...")

    from breadbox.schemas.dataset import MatrixDatasetResponse

    return UploadDatasetResponse(
        dataset=MatrixDatasetResponse.model_validate(added_dataset),
        datasetId=str(added_dataset.id),
        warnings=[warning],
        forwardingUrl=forwardingUrl,
    )


# Note: This looks like a task, but does not actually use celery/redis, because it's
# not actually registered in breadbox/breadbox/compute/celery.py. If we run into problems
# with large uploads, and need to finish implementing this function as a celery task,
#  we just need to:
#   (1) modify a few of the unserializable objects, such as UploadDatasetResponse, Group, etc.
#   (2) include the task in breadbox/breadbox/compute/celery.py (and the celery_includes pytest fixture)
#   (3) Change the caller to use .delay instead of .apply
#   (4) Implement a Progress Tracker in frontend components that rely on add_dataset
@app.task(bind=True)
def run_upload_dataset(
    task: celery.Task,
    name: str,
    units: str,
    feature_type: Optional[str],
    sample_type: str,
    data_type: str,
    data_file_dict: FileDict,
    value_type: ValueType,
    priority: Optional[int],
    taiga_id: Optional[str],
    allowed_values: Optional[Set[str]],
    is_transient: bool,
    user: str,
    group_id: Optional[UUID],
    dataset_metadata: Optional[Dict[str, Any]],
    data_file_format: str,
):
    with db_context(user, commit=True) as db:
        start_time = time.time()
        last_state_update = {
            "start_time": start_time,
            "message": "Beginning upload...",
        }

        # This is here for if/when we want to complete celery support
        if not task.request.called_directly:
            pass
            # task.update_state(
            #     state="PROGRESS", meta=last_state_update,
            # )

        def update_message(
            message=None, start_time=None, max_time: int = 45, percent_complete=None
        ):
            """
            :start_time: the presence of this is used to determine whether we show a progress presented
            :max_time: used to calculate to the end of a fake gloating bar
            """
            # remember the value used for the last update_message so that we don't have to pass all the parameters every time.
            nonlocal last_state_update

            last_state_update["message"] = message
            last_state_update["start_time"] = start_time
            last_state_update["percent_complete"] = percent_complete
            last_state_update["max_time"] = max_time

            # This is here for if/when we want to complete celery support
            if not task.request.called_directly:
                pass
                # task.update_state(
                #     state="PROGRESS", meta=last_state_update,
                # )

        data_file: UploadFile = _get_upload_file_from_file_dict(data_file_dict)

        settings = get_settings()

        upload_dataset_response = upload_dataset(
            db=db,
            settings=settings,
            name=name,
            units=units,
            feature_type=feature_type,
            sample_type=sample_type,
            data_type=data_type,
            data_file=data_file,
            value_type=value_type,
            priority=priority,
            taiga_id=taiga_id,
            allowed_values=allowed_values,
            is_transient=is_transient,
            user=user,
            group_id=str(group_id),
            update_message=update_message,
            dataset_metadata=dataset_metadata,
            data_file_format=data_file_format,
        )

        return upload_dataset_response
