from typing import List, Optional, Set, Union
from logging import getLogger
from uuid import UUID
from ..db.util import transaction

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    Query,
    Body,
    Response,
    Query,
)


from breadbox.db.session import SessionWithUser
from breadbox.celery_task import utils

from breadbox.compute.dataset_tasks import (
    get_file_dict,
    run_upload_dataset,
)
from ..schemas.custom_http_exception import UserError

from ..config import Settings, get_settings
from breadbox.crud.access_control import PUBLIC_GROUP_ID
from ..crud import dataset as dataset_crud
from ..crud import types as type_crud
from ..crud import group as group_crud

from ..models.dataset import (
    Dataset as DatasetModel,
    ValueType,
    MatrixDataset,
)

from ..io.filestore_crud import get_feature_slice
from ..schemas.dataset import (
    AddDatasetResponse,
    DatasetResponse,
    DatasetMetadata,
    DimensionSearchIndexResponse,
    FeatureResponse,
    FeatureSampleIdentifier,
    MatrixDimensionsInfo,
    TabularDimensionsInfo,
    UpdateDatasetParams,
    MatrixDatasetUpdateParams,
    TabularDatasetUpdateParams,
    DimensionDataResponse,
    SliceQueryParam,
)
from .dependencies import get_dataset as get_dataset_dep
from .dependencies import get_db_with_user, get_user


router = APIRouter(prefix="/datasets", tags=["datasets"])
log = getLogger(__name__)


@router.get(
    "/",
    operation_id="get_datasets",
    response_model=List[DatasetResponse],
    response_model_by_alias=False,
    response_model_exclude_none=False,
)
def get_datasets(
    feature_id: Optional[str] = None,
    feature_type: Optional[str] = None,
    sample_id: Optional[str] = None,
    sample_type: Optional[str] = None,
    value_type: Optional[ValueType] = None,
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
):
    """
    Get metadata for all datasets available to current user.

    If `feature_id` and `feature_type` are specified, we return only the datasets that contain that feature.

    If `feature_type` is specified without `feature_id`, then we return the datasets
    that have that `feature_type`.

    Similar for `sample_id` and `sample_type`.
    """
    datasets = dataset_crud.get_datasets(
        db, user, feature_id, feature_type, sample_id, sample_type, value_type
    )
    return [dataset for dataset in datasets]


@router.get(
    "/features/{dataset_id}", operation_id="get_dataset_features",
)
def get_dataset_features(
    dataset_id: str,
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
):
    """
    Get information about each feature belonging to a given dataset.
    """
    dataset = dataset_crud.get_dataset(db=db, user=user, dataset_id=dataset_id)
    if dataset is None:
        raise HTTPException(404, "Dataset not found")

    feature_labels_by_id = dataset_crud.get_dataset_feature_labels_by_id(
        db=db, user=user, dataset=dataset,
    )
    return [{"id": id, "label": label} for id, label in feature_labels_by_id.items()]


@router.get(
    "/samples/{dataset_id}", operation_id="get_dataset_samples",
)
def get_dataset_samples(
    dataset_id: str,
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
):
    """
    Get information about each sample belonging to a given dataset.
    For example, if the samples are depmap models, then this should
    return depmap_ids as ids and cell line names as labels.
    """
    dataset = dataset_crud.get_dataset(db=db, user=user, dataset_id=dataset_id)
    if dataset is None:
        raise HTTPException(404, "Dataset not found")

    sample_labels_by_id = dataset_crud.get_dataset_sample_labels_by_id(
        db=db, user=user, dataset=dataset,
    )
    return [{"id": id, "label": label} for id, label in sample_labels_by_id.items()]


@router.get(
    "/features/data/",
    operation_id="get_feature_data",
    response_model=List[FeatureResponse],
)
def get_feature_data(
    dataset_ids: List[str] = Query(
        default=[],
        alias="dataset_ids",
        description="dataset UUIDs specifying which dataset contains each given feature",
    ),
    feature_ids: List[str] = Query(
        default=[],
        alias="feature_ids",
        description="natural keys specifying the features for which data should be retrieved",
    ),
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
    settings: Settings = Depends(get_settings),
):
    """
    Load data for each of the given dataset_id, feature_id pairs.
    This differs from the /get-features endpoint in the type of ID it
    accepts as input and the format of the response. This endpoint also
    does not do any filtering or grouping of feature values.
    """
    if len(dataset_ids) != len(feature_ids):
        raise UserError(
            f"Expected dataset_id, feature_id pairs. The number of dataset ids and feature ids provided should be equal."
        )

    feature_data = []
    for i in range(len(feature_ids)):
        feature = dataset_crud.get_dataset_feature_by_given_id(
            db=db, dataset_id=dataset_ids[i], feature_given_id=feature_ids[i]
        )
        dataset = feature.dataset
        if not isinstance(dataset, MatrixDataset):
            raise UserError(
                f"Expected a matrix dataset. Unable to load feature data for tabular dataset: '{feature.dataset_id}' "
            )
        # Read data from the HDF5 file
        df = get_feature_slice(dataset, [feature.index], settings.filestore_location)
        # Get the feature label
        if dataset.feature_type_name:
            # Note: this would be faster if we had a query to load one label instead of all labels - but performance hasn't been an issue
            feature_labels_by_id = dataset_crud.get_dataset_feature_labels_by_id(
                db=db, user=user, dataset=dataset
            )
            label = feature_labels_by_id[feature.given_id]
        else:
            label = feature.given_id
        feature_response = FeatureResponse(
            values=df[feature.given_id].to_dict(),
            label=label,
            feature_id=feature.given_id,
            dataset_id=feature.dataset_id,
            units=dataset.units,
            dataset_label=dataset.name,
        )
        feature_data.append(feature_response)
    return feature_data


from pydantic import Json


@router.post(
    "/", operation_id="add_dataset", response_model=AddDatasetResponse,
)
def add_dataset(
    name: str = Form(..., description="Name of dataset, used for display"),
    units: str = Form(
        ..., description="Units for the values in the dataset, used for display"
    ),
    data_type: str = Form(..., description="Data type grouping for your dataset"),
    data_file: UploadFile = File(
        ...,
        description="CSV file of your dataset with feature ids as columns and sample ids as rows.",
    ),
    is_transient: bool = Form(
        ...,
        description="Transient datasets can be deleted - should only be set to true for non-public short-term-use datasets like custom analysis results.",
    ),
    feature_type: str = Form(
        None, description="Type of features your dataset contains"
    ),  # Either feature_type or sample_type must be given
    sample_type: str = Form(..., description="Type of samples your dataset contains"),
    group_id: UUID = Form(
        None,
        description=f"ID of the group the dataset belongs to. Required for non-transient datasets. The public group is `{PUBLIC_GROUP_ID}`.",
    ),  # Required for non-transient datasets
    value_type: ValueType = Form(
        ...,
        description="Value 'continuous' if dataset contains numerical values or 'categorical' if dataset contains string categories as values.",
    ),
    priority: int = Form(
        None,
        description="Numeric value assigned to the dataset with `1` being highest priority within the `data_type`, used for displaying order of datasets to show for a specific `data_type` in UI.",
    ),
    taiga_id: str = Form(None, description="Taiga ID the dataset is sourced from."),
    allowed_values: Set[str] = Query(
        None,
        min_length=1,
        description="Only provide if 'value_type' is 'categorical'. Must contain all possible categorical values",
    ),
    dataset_metadata: Optional[Json[DatasetMetadata]] = Form(
        None,
        description="Contains a dictionary of additional dataset values that are not already provided above.",
    ),
    user: str = Depends(get_user),
):
    """
    Create a new dataset.
    """
    data_file_dict = get_file_dict(
        data_file
    )  # TODO: Remove after change to file id uploads?

    dataset_metadata_ = None
    if dataset_metadata is not None:
        dataset_metadata_ = dataset_metadata.dataset_metadata

    try:
        r = utils.cast_celery_task(run_upload_dataset).apply(
            args=[
                name,
                units,
                feature_type,
                sample_type,
                data_type,
                data_file_dict,
                value_type,
                priority,
                taiga_id,
                allowed_values,
                is_transient,
                user,
                group_id,
                dataset_metadata_,
                "csv",
            ]
        )
    except PermissionError as e:
        raise HTTPException(404, detail=str(e))

    response = utils.format_task_status(r)

    return response


@router.get(
    "/{dataset_id}",
    operation_id="get_dataset",
    response_model=DatasetResponse,
    response_model_by_alias=False,
)
def get_dataset(dataset: DatasetModel = Depends(get_dataset_dep)):
    """Get metadata for a dataset, if it exists and is available to the user."""
    return dataset


from typing import Annotated


@router.post(
    "/matrix/{dataset_id}", operation_id="get_matrix_dataset_data",
)
def get_matrix_dataset_data(
    db: Annotated[SessionWithUser, Depends(get_db_with_user)],
    user: Annotated[str, Depends(get_user)],
    settings: Annotated[Settings, Depends(get_settings)],
    dataset: Annotated[DatasetModel, Depends(get_dataset_dep)],
    matrix_dimensions_info: Annotated[
        MatrixDimensionsInfo, Body(default_factory=MatrixDimensionsInfo)
    ],
    strict: Annotated[
        bool,
        Query(
            description="If 'strict' set to True, missing indices or columns will return an error"
        ),
    ] = False,
):
    try:
        df = dataset_crud.get_subsetted_matrix_dataset_df(
            db,
            user,
            dataset,
            matrix_dimensions_info,
            settings.filestore_location,
            strict,
        )
    except UserError as e:
        raise e
    return Response(df.to_json(), media_type="application/json")


@router.post(
    "/tabular/{dataset_id}", operation_id="get_tabular_dataset_data",
)
def get_tabular_dataset_data(
    db: Annotated[SessionWithUser, Depends(get_db_with_user)],
    user: Annotated[str, Depends(get_user)],
    dataset: Annotated[DatasetModel, Depends(get_dataset_dep)],
    tabular_dimensions_info: Annotated[
        TabularDimensionsInfo, Body(default_factory=TabularDimensionsInfo)
    ],
    strict: Annotated[
        bool,
        Query(
            description="If 'strict' set to True, missing indices or columns will return an error"
        ),
    ] = False,
):
    try:
        df = dataset_crud.get_subsetted_tabular_dataset_df(
            db, user, dataset, tabular_dimensions_info, strict
        )
    except UserError as e:
        raise e
    return Response(df.to_json(), media_type="application/json")


@router.post("/data/{dataset_id}", operation_id="get_dataset_data", deprecated=True)
def get_dataset_data(
    db: Annotated[SessionWithUser, Depends(get_db_with_user)],
    user: Annotated[str, Depends(get_user)],
    settings: Annotated[Settings, Depends(get_settings)],
    dataset: Annotated[DatasetModel, Depends(get_dataset_dep)],
    features: Annotated[
        Optional[List[str]],
        Body(
            description="list of feature labels or ids for which data should be retrieved",
        ),
    ] = None,
    feature_identifier: Annotated[
        Optional[FeatureSampleIdentifier],
        Body(
            description="Denotes whether the list of features are given as ids or feature labels",
        ),
    ] = None,
    samples: Annotated[
        Optional[List[str]],
        Body(
            description="list of sample labels or ids for which data should be retrieved",
        ),
    ] = None,
    sample_identifier: Annotated[
        Optional[FeatureSampleIdentifier],
        Body(
            description="Denotes whether the list of samples are given as ids or sample labels",
        ),
    ] = None,
):
    """Get dataset dataframe subset given the features and samples. Filtering should be possible using either labels (cell line name, gene name, etc.) or ids (depmap_id, entrez_id, etc.). If features or samples are not specified, return all features or samples"""
    try:
        dim_info = MatrixDimensionsInfo(
            features=features,
            feature_identifier=feature_identifier,
            samples=samples,
            sample_identifier=sample_identifier,
        )
    except UserError as e:
        raise e

    df = dataset_crud.get_subsetted_matrix_dataset_df(
        db, user, dataset, dim_info, settings.filestore_location
    )

    # NOTE: to_json() is better than to_dict() bc FastAPI behind the scenes automatically converts the non-JSON objects into JSON-compatible data using the jsonable_encoder, and then uses the Python standard json.dumps() to serialise the object which is quite slow.
    # To avoid the extra processing, use to_json() method and put the JSON string in a custom Response and return it directly
    # See: https://stackoverflow.com/questions/71203579/how-to-return-a-csv-file-pandas-dataframe-in-json-format-using-fastapi and https://stackoverflow.com/questions/73564771/fastapi-is-very-slow-in-returning-a-large-amount-of-json-data/73580096#73580096
    return Response(df.to_json(), media_type="application/json")


@router.get(
    "/dimensions/",
    operation_id="get_dimensions",
    response_model=List[DimensionSearchIndexResponse],
)
def get_dimensions(
    limit: int,
    include_referenced_by: str = "F",
    prefix: Annotated[Optional[List[str]], Query()] = None,
    # curiously, when switching `substring` from str to list, I had to explictly
    # annotate it so that fastapi would look for it as a query parameter and not
    # look for it in the payload body.
    substring: Annotated[Optional[List[str]], Query()] = None,
    type_name: Optional[str] = None,
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
):
    """
    Get dimension search index results for the given prefix, with results ordered by priority and then label.
    """

    if include_referenced_by not in ["T", "F"]:
        raise HTTPException(
            400, "if provided, include_referenced_by must either be 'T' or 'F'"
        )

    if substring is None:
        substring = []

    if prefix is None:
        prefix = []

    search_index_entries = dataset_crud.get_dataset_dimension_search_index_entries(
        db=db,
        user=user,
        prefixes=prefix,
        dimension_type_name=type_name,
        limit=limit,
        substrings=substring,
        include_referenced_by=(include_referenced_by == "T"),
    )

    return search_index_entries


@router.get(
    "/dimension/data/",
    operation_id="get_dimension_data",
    response_model=DimensionDataResponse,
)
def get_dimension_data(
    slice_query: SliceQueryParam,
    db: SessionWithUser = Depends(get_db_with_user),
    settings: Settings = Depends(get_settings),
):
    """
    Load all values, IDs, and labels for a given dimension (specified by SliceQuery).
    """
    slice_values_by_id = dataset_crud.get_slice_data(
        db, settings.filestore_location, slice_query
    )

    # labels_by_id =

    pass


@router.patch(
    "/{dataset_id}",
    operation_id="update_dataset",
    response_model=DatasetResponse,
    response_model_by_alias=False,
)
def update_dataset(
    dataset_update_params: UpdateDatasetParams,
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
    dataset: DatasetModel = Depends(get_dataset_dep),
):
    """
    Update the dataset metadata

    The following parameters may be provided or omitted if no change for the value:
    `format` - Required parameter. Must be 'matrix' or 'tabular' and match the format of the given dataset
    `name` - Optional parameter. Name of dataset
    `data_type` - Optional parameter. Data type grouping for your dataset
    `group_id` - Optional parameter. Id of the group the dataset belongs to
    `priority` - Optional parameter. Numeric value representing priority of the dataset within its `data_type`
    `dataset_metadata` - Optional parameter. A dictionary of additional dataset metadata that is not already provided
    `units` - Optional parameter for matrix dataset only. Units for the values in the dataset

    """
    if dataset.format == "matrix_dataset":
        if not isinstance(dataset_update_params, MatrixDatasetUpdateParams):
            raise UserError(
                "Allowed parameters to update for dataset with `matrix` format are `name`, `units`, `data_type`, `group_id`, `priority` and `dataset_metadata`. Please make sure your request body contains those parameters with the correct value types!"
            )
    if dataset.format == "tabular_dataset":
        if not isinstance(dataset_update_params, TabularDatasetUpdateParams):
            raise UserError(
                "Allowed parameters to update for dataset with `tabular` format are `name`, `data_type`, `group_id`, `priority` and `dataset_metadata`. Please make sure your request body contains those parameters with the correct value types!"
            )

    with transaction(db):
        updated_dataset = dataset_crud.update_dataset(
            db, user, dataset, dataset_update_params
        )

    return updated_dataset


@router.delete(
    "/{dataset_id}", operation_id="remove_dataset",
)
def delete_dataset(
    dataset_id: UUID,
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
    settings: Settings = Depends(get_settings),
):
    """Delete a dataset, if the user has write permissions for the containing group.

    `dataset_id` - UUID string of the dataset id
    """
    dataset = dataset_crud.get_dataset(db, user, dataset_id)
    if dataset is None:
        raise HTTPException(404, "Dataset not found")

    if not dataset_crud.user_has_access_to_group(
        dataset.group, user, write_access=True
    ):
        raise HTTPException(403, "You do not have permission to delete this dataset")

    # Dimension type metadata datasets must not be used in other datasets
    if dataset.format == "tabular_dataset":
        dim_type = type_crud.get_dimension_type(db, dataset.index_type_name)
        # We should always have a dimension type for tabular datasets
        assert dim_type is not None
        if dim_type.dataset_id == str(dataset_id):
            raise UserError(
                f"Cannot delete {dim_type.axis} type {dim_type.name}'s metadata without first deleting {dim_type.name}!"
            )

    with transaction(db):
        if dataset_crud.delete_dataset(db, user, dataset, settings.filestore_location):
            return {"message": "Dataset deleted!"}
    raise HTTPException(400)
