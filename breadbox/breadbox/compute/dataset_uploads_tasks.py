from uuid import UUID, uuid4
from typing import Any, List, Optional, Union, Literal, Dict

from itsdangerous.url_safe import URLSafeSerializer

import json

from breadbox.db.session import SessionWithUser
from breadbox.schemas.dataset import (
    MatrixDatasetIn,
    TabularDatasetIn,
    UploadDatasetResponseV2,
    UnknownIDs,
    DatasetParams,
    MatrixDatasetParams,
    TableDatasetParams,
)
from breadbox.schemas.custom_http_exception import ResourceNotFoundError
from breadbox.models.dataset import DimensionType
from fastapi import HTTPException
from breadbox.io.filestore_crud import save_dataset_file
from ..service import dataset as dataset_service
from ..crud import dimension_types as type_crud
from ..crud import group as group_crud
from ..crud import data_type as data_type_crud
from ..crud import dataset as dataset_crud
from .dataset_tasks import db_context
from ..api.uploads import construct_file_from_ids
from ..io.data_validation import (
    read_and_validate_matrix_df,
    _get_dimension_labels_and_warnings,
    read_and_validate_tabular_df,
)
from .celery import app
import celery
from ..config import get_settings
import time


@app.task(bind=True)
def run_dataset_upload(
    self: celery.Task, dataset_params: Dict, user: str,
):
    with db_context(user, commit=True) as db:
        if dataset_params["format"] == "matrix":
            params: DatasetParams = MatrixDatasetParams(**dataset_params)
        else:
            params: DatasetParams = TableDatasetParams(**dataset_params)

        upload_dataset_response = dataset_upload(db, params, user)

        # because celery is going to want to serialize the response,
        # convert it to a json dict before returning it
        # also, using the hack described at https://stackoverflow.com/questions/65622045/pydantic-convert-to-jsonable-dict-not-full-json-string
        return json.loads(upload_dataset_response.json())


def dataset_upload(
    db: SessionWithUser, dataset_params: DatasetParams, user: str,
):
    settings = get_settings()

    # NOTE: We make this check in the dataset_crud.add_dataset function too, because we
    # want to have access checks at the crud layer. But we also want to check this before we
    # do any work validating the dataset.
    _validate_group(db, user, dataset_params.group_id)
    _validate_data_type(db, dataset_params.data_type)

    given_id = parse_and_validate_dataset_given_id(
        db=db,
        dataset_given_id=dataset_params.given_id,
        dataset_metadata=dataset_params.dataset_metadata,
    )

    serializer = URLSafeSerializer(settings.breadbox_secret)

    file_path = construct_file_from_ids(
        dataset_params.file_ids,
        dataset_params.dataset_md5,
        serializer,
        settings.compute_results_location,
    )

    dataset_id = str(uuid4())

    unknown_ids = []

    if dataset_params.format == "matrix":
        feature_type = (
            _get_dimension_type(db, dataset_params.feature_type, "feature")
            if dataset_params.feature_type
            else None
        )
        sample_type = _get_dimension_type(db, dataset_params.sample_type, "sample")

        start_time = time.perf_counter()
        data_df = read_and_validate_matrix_df(
            file_path,
            dataset_params.value_type,
            dataset_params.allowed_values,
            dataset_params.data_file_format,
        )
        end_time = time.perf_counter()
        execution_time = end_time - start_time
        print(f"Validation Execution time: {execution_time:.4f} seconds")

        feature_labels_and_warnings = _get_dimension_labels_and_warnings(
            db, data_df.columns.to_list(), feature_type
        )
        if len(feature_labels_and_warnings.warnings) > 0:
            assert feature_type is not None
            unknown_ids.append(
                UnknownIDs(
                    dimensionType=feature_type.name,
                    axis=feature_type.axis,
                    IDs=feature_labels_and_warnings.warnings,
                )
            )

        sample_labels_and_warnings = _get_dimension_labels_and_warnings(
            db, data_df.index.to_list(), sample_type
        )
        if len(sample_labels_and_warnings.warnings) > 0:
            unknown_ids.append(
                UnknownIDs(
                    dimensionType=sample_type.name,
                    axis=sample_type.axis,
                    IDs=sample_labels_and_warnings.warnings,
                )
            )

        # Add to db
        dataset_in = MatrixDatasetIn(
            id=dataset_id,
            name=dataset_params.name,
            units=dataset_params.units,
            feature_type_name=dataset_params.feature_type,
            sample_type_name=dataset_params.sample_type,
            data_type=dataset_params.data_type,
            is_transient=dataset_params.is_transient,
            group_id=str(dataset_params.group_id),
            value_type=dataset_params.value_type,
            priority=dataset_params.priority,
            taiga_id=dataset_params.taiga_id,
            given_id=given_id,
            allowed_values=dataset_params.allowed_values,
            dataset_metadata=dataset_params.dataset_metadata,
            dataset_md5=dataset_params.dataset_md5,
        )

        added_dataset = dataset_service.add_matrix_dataset(
            db,
            user,
            dataset_in,
            feature_labels_and_warnings.given_id_to_index,
            sample_labels_and_warnings.given_id_to_index,
            feature_type,
            sample_type,
            dataset_params.short_name,
            dataset_params.version,
            dataset_params.description,
        )
        print(f"Starting write...")
        start_time = time.perf_counter()
        save_dataset_file(
            dataset_id, data_df, dataset_params.value_type, settings.filestore_location
        )
        # Code to be timed
        end_time = time.perf_counter()
        execution_time = end_time - start_time
        print(f"WRITE Execution time: {execution_time:.4f} seconds")

    else:
        index_type = _get_dimension_type(db, dataset_params.index_type)
        data_df = read_and_validate_tabular_df(
            db, index_type, file_path, dataset_params.columns_metadata
        )
        dimension_labels_and_warnings = _get_dimension_labels_and_warnings(
            db, data_df[index_type.id_column], index_type
        )
        if len(dimension_labels_and_warnings.warnings) > 0:
            unknown_ids.append(
                UnknownIDs(
                    dimensionType=index_type.name,
                    axis=index_type.axis,
                    IDs=dimension_labels_and_warnings.warnings,
                )
            )

        # Add to db
        dataset_in = TabularDatasetIn(
            id=dataset_id,
            given_id=given_id,
            name=dataset_params.name,
            index_type_name=dataset_params.index_type,
            data_type=dataset_params.data_type,
            is_transient=dataset_params.is_transient,
            group_id=str(dataset_params.group_id),
            priority=dataset_params.priority,
            taiga_id=dataset_params.taiga_id,
            dataset_metadata=dataset_params.dataset_metadata,
            dataset_md5=dataset_params.dataset_md5,
        )
        added_dataset = dataset_service.add_tabular_dataset(
            db,
            user,
            dataset_in,
            data_df,
            dataset_params.columns_metadata,
            index_type,
            dataset_params.short_name,
            dataset_params.version,
            dataset_params.description,
        )

    # NOTE: The return value of dataset_crud.add_dataset can be None if the user
    # doesn't have access to write to the group, but we also check for that at the
    # beginning of this function, so it shouldn't be None here.
    if added_dataset is None:
        raise HTTPException(500)

    # Celery statement
    # if update_message:
    #     update_message("Wrapping up upload...")
    upload_dataset_response = UploadDatasetResponseV2(
        dataset=added_dataset, datasetId=str(added_dataset.id), unknownIDs=unknown_ids,
    )
    return upload_dataset_response


def format_warnings(warnings: List[str], dimension_type: DimensionType) -> str:
    warning = (
        f"{dimension_type.axis.capitalize()}s: {warnings} not in {dimension_type.name} metadata. Consider updating your {dimension_type.axis} type metadata!"
        if len(warnings)
        else ""
    )
    return warning


def _get_dimension_type(
    db: SessionWithUser,
    dim_type_name: str,
    axis: Optional[Literal["feature", "sample"]] = None,
) -> DimensionType:
    dimension_type = type_crud.get_dimension_type(db, dim_type_name)
    if dimension_type is None:
        raise ResourceNotFoundError(
            f"{axis.capitalize() if axis else 'Dimension'} type '{dim_type_name}' does not exist!"
        )
    if axis:
        if dimension_type.axis != axis:
            raise ResourceNotFoundError(
                f"'{dim_type_name}' is of {dimension_type.axis} type not {axis} type!"
            )
    return dimension_type


def parse_and_validate_dataset_given_id(
    db: SessionWithUser,
    dataset_given_id: Optional[str],
    dataset_metadata: Optional[Dict[str, Any]],
) -> Optional[str]:
    """
    For backwards compatibility, parse the given id from the dataset_metadata
    (given_id had previously been stored in the legacy_dataset_id metadata field).
    Validate that there isn't already a dataset with this given ID. 
    """
    if dataset_given_id is None and dataset_metadata:
        given_id = dataset_metadata.get("legacy_dataset_id")
    else:
        given_id = dataset_given_id

    if given_id is not None:
        existing_dataset = dataset_crud.get_dataset(db, db.user, given_id)
        if existing_dataset is not None:
            raise HTTPException(
                409, f"A dataset with the given id {given_id} already exists."
            )
    return given_id


def _validate_group(db: SessionWithUser, user: str, group_id: Union[str, UUID]):
    group = group_crud.get_group(db, user, group_id, write_access=True)
    if group is None:
        if group_crud.get_group(db, user, group_id, write_access=False) is not None:
            raise HTTPException(
                403, "You do not have permissions to add a dataset to this group"
            )
        raise HTTPException(404, detail=f"Group not found: '{group_id}'")


def _validate_data_type(db: SessionWithUser, data_type_name: str):
    data_type = data_type_crud.get_data_type(db, data_type_name)
    if data_type is None:
        raise HTTPException(404, f"Data type not found: '{data_type_name}'")
    return data_type
