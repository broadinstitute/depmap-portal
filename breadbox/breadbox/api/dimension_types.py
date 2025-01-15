from typing import List, Optional, Literal, Union, Annotated
from logging import getLogger
from uuid import UUID, uuid4
from collections import defaultdict
from fastapi import (
    APIRouter,
    Body,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    Query,
)
from breadbox.models.dataset import Dataset
from breadbox.models.dataset import DimensionType as DimensionTypeModel
from breadbox.schemas.types import IdMappingInsanity
from typing import Annotated

from breadbox.db.session import SessionWithUser
from .dependencies import get_db_with_user, get_user
from ..config import Settings, get_settings
from ..crud import dimension_types as type_crud
from ..crud.dataset import get_datasets
from ..schemas.types import (
    AnnotationTypeMap,
    IdMapping,
    TypeMetadataIn,
    FeatureTypeOut,
    SampleTypeOut,
)
from typing import cast
from ..io.data_validation import validate_dimension_type_metadata
from ..schemas.custom_http_exception import UserError, ResourceNotFoundError
from breadbox.models.dataset import AnnotationType
import breadbox.service.dataset as dataset_service
from breadbox.schemas.types import (
    DimensionType,
    UpdateDimensionType,
    AddDimensionType,
    DimensionIdentifiers,
)
from breadbox.service import metadata as metadata_service
from .settings import assert_is_admin_user
from breadbox.db.util import transaction


from breadbox.service import dataset as dataset_service
from breadbox.service.dataset import check_id_mapping_is_valid

router = APIRouter(prefix="/types", tags=["types"])
log = getLogger(__name__)


# the response_model_by_alias=False in the below is necessary to support renaming fields in what's returned
# ie: sample_type -> name
from breadbox.schemas.custom_http_exception import FileValidationError
from typing import Dict
from pydantic import Json


@router.post(
    "/sample",
    operation_id="add_sample_type",
    response_model=SampleTypeOut,
    response_model_by_alias=False,
    response_model_exclude_none=True,
    deprecated=True,
)
def add_sample_type(
    name: str = Form(...),
    id_column: str = Form(...),
    metadata_file: UploadFile = File(None),
    taiga_id: Optional[str] = Form(None),
    annotation_type_mapping: Union[Json[AnnotationTypeMap], None] = Body(None),
    id_mapping: Optional[IdMapping] = Body(
        default=None,
        description="A mapping of dataset column names to the feature type name those columns reference.",
    ),
    properties_to_index: List[str] = Form(
        description="A list of columns by name to add to the dimension search index.",
        default_factory=lambda: [],
    ),
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
    settings: Settings = Depends(get_settings),
):
    axis = "sample"

    assert (
        isinstance(annotation_type_mapping, AnnotationTypeMap)
        or annotation_type_mapping is None
    )

    annotation_type_mapping_: Dict[str, AnnotationType] = {}
    if annotation_type_mapping is not None:
        annotation_type_mapping_ = annotation_type_mapping.annotation_type_mapping

    assert isinstance(id_mapping, IdMapping) or id_mapping is None
    reference_column_mappings: Dict[str, str] = {}
    if id_mapping is not None:
        reference_column_mappings = id_mapping.reference_column_mappings

    # hack: this endpoint is going away so for the time being and we don't have continous values in our
    # metadata at this time, don't worry about the units -- but not providing units causes an assert later
    units_per_column = {
        column_name: "value" for column_name in annotation_type_mapping_
    }

    with transaction(db):
        return add_dimension_type(
            axis,
            name,
            id_column,
            metadata_file,
            taiga_id,
            annotation_type_mapping_,
            reference_column_mappings,
            properties_to_index,
            db,
            user,
            settings,
            units_per_column,
        )


def add_dimension_type(
    axis: Literal["feature", "sample"],
    name: str,
    id_column: str,
    metadata_file: Optional[UploadFile],
    taiga_id: Optional[str],
    annotation_type_mapping: Dict[str, AnnotationType],
    reference_column_mappings: Dict[str, str],
    properties_to_index: Optional[List[str]],
    db: SessionWithUser,
    user: str,
    settings: Settings,
    units_per_column: Dict[str, str],
):
    """NOTE: This function is only used in the deprecated add_sample_type and add_feature_type endpoints"""
    # Check if sample type already exists
    existing_dimension_type = type_crud.get_dimension_type(db, name)
    if existing_dimension_type is not None:
        raise HTTPException(
            400,
            f"Dimension type {name} already exists as a {existing_dimension_type.axis} type!",
        )

    if user not in settings.admin_users:
        raise HTTPException(403)

    metadata_df = None
    if metadata_file:
        if annotation_type_mapping is None:
            raise HTTPException(
                400,
                detail="If metadata table provided, you must also provide annotation_type_mapping",
            )

        try:
            metadata_df = validate_dimension_type_metadata(
                metadata_file, annotation_type_mapping, name, id_column,
            )
        except FileValidationError as e:
            log.error(e)
            raise HTTPException(400, detail=str(e)) from e

    with transaction(db):
        dimension_type = dataset_service.add_dimension_type(
            db,
            settings,
            user,
            name,
            display_name=name,  # Placeholder value doesn't matter for deprecated function
            axis=axis,
            id_column=id_column,
            metadata_df=metadata_df,
            annotation_type_mapping=annotation_type_mapping,
            reference_column_mappings=reference_column_mappings,
            properties_to_index=properties_to_index,
            taiga_id=taiga_id,
            units_per_column=units_per_column,
        )

    assert dimension_type is not None

    return dimension_type


@router.post(
    "/feature",
    operation_id="add_feature_type",
    response_model=FeatureTypeOut,
    response_model_by_alias=False,
    response_model_exclude_none=True,
    deprecated=True,
)
def add_feature_type(
    name: Annotated[str, Form(...)],
    id_column: Annotated[str, Form(...)],
    db: Annotated[SessionWithUser, Depends(get_db_with_user)],
    user: Annotated[str, Depends(get_user)],
    settings: Annotated[Settings, Depends(get_settings)],
    properties_to_index: Annotated[
        List[str],
        Form(
            description="A list of columns by name to add to the dimension search index.",
            default_factory=lambda: [],
        ),
    ],
    taiga_id: Annotated[Optional[str], Form()] = None,
    annotation_type_mapping: Annotated[
        Union[Json[AnnotationTypeMap], None], Body()
    ] = None,
    id_mapping: Annotated[
        Union[Json[IdMappingInsanity], None],
        Body(
            description="A mapping of dataset column names to the feature type name those columns reference.",
        ),
    ] = None,
    metadata_file: Annotated[Optional[UploadFile], File()] = None,
):
    axis = "feature"

    assert (
        isinstance(annotation_type_mapping, AnnotationTypeMap)
        or annotation_type_mapping is None
    )
    annotation_type_mapping_: Dict[str, AnnotationType] = {}
    if annotation_type_mapping is not None:
        annotation_type_mapping_ = annotation_type_mapping.annotation_type_mapping

    if isinstance(id_mapping, IdMappingInsanity):
        id_mapping = id_mapping.id_mapping

    assert isinstance(id_mapping, IdMapping) or id_mapping is None
    reference_column_mappings: Dict[str, str] = {}
    if id_mapping is not None:
        reference_column_mappings = id_mapping.reference_column_mappings

    # hack: this endpoint is going away so for the time being and we don't have continous values in our
    # metadata at this time, don't worry about the units -- but not providing units causes an assert later
    units_per_column = {
        column_name: "value" for column_name in annotation_type_mapping_
    }

    with transaction(db):
        return add_dimension_type(
            axis,
            name,
            id_column,
            metadata_file,
            taiga_id,
            annotation_type_mapping_,
            reference_column_mappings,
            properties_to_index,
            db,
            user,
            settings,
            units_per_column,
        )


@router.get(
    "/sample",
    operation_id="get_sample_types",
    response_model=List[SampleTypeOut],
    response_model_by_alias=False,
    response_model_exclude_none=True,
    deprecated=True,
)
def get_sample_types(db: SessionWithUser = Depends(get_db_with_user)):
    samples = type_crud.get_dimension_types(db, axis="sample")
    return samples


@router.get(
    "/feature",
    operation_id="get_feature_types",
    response_model=List[FeatureTypeOut],
    response_model_by_alias=False,
    response_model_exclude_none=True,
    deprecated=True,
)
def get_feature_types(db: SessionWithUser = Depends(get_db_with_user)):
    features = type_crud.get_dimension_types(db, axis="feature")
    return features


@router.patch(
    "/sample/{sample_type_name}/metadata",
    operation_id="update_sample_type_metadata",
    response_model=SampleTypeOut,
    response_model_exclude_none=True,
    deprecated=True,
)
def update_sample_type_metadata(
    sample_type_name: str,
    metadata_file: UploadFile = File(...),
    taiga_id: str = Form(None),
    annotation_type_mapping: Union[Json[AnnotationTypeMap], None] = Body(None),
    id_mapping: Union[Json[IdMappingInsanity], None] = Body(
        default=None,
        description="A mapping of dataset column names to the feature type name those columns reference.",
    ),
    properties_to_index: List[str] = Form(
        description="A list of columns by name to add to the dimension search index.",
        default_factory=lambda: [],
    ),
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
    settings: Settings = Depends(get_settings),
):
    if sample_type_name == "generic":
        raise HTTPException(400, "Cannot add metadata to feature type 'generic'.")
    if user not in settings.admin_users:
        raise HTTPException(
            403, f"User: {user} does not have permission to update the metadata."
        )
    sample_type = type_crud.get_dimension_type(db, sample_type_name)
    if sample_type is None:
        raise HTTPException(404, f"Sample type {sample_type_name} not found!")
    if metadata_file is None:
        raise HTTPException(400, f"Sample type metadata needs a 'metadata_file'.")

    if isinstance(id_mapping, IdMappingInsanity):
        id_mapping = id_mapping.id_mapping

    annotation_type_mapping_: Dict[str, AnnotationType] = {}
    if annotation_type_mapping is not None:
        annotation_type_mapping_ = annotation_type_mapping.annotation_type_mapping

    sample_type_in = TypeMetadataIn(
        name=sample_type_name,
        id_column=sample_type.id_column,
        axis=sample_type.axis,
        metadata_file=metadata_file,
        taiga_id=taiga_id,
        annotation_type_mapping=annotation_type_mapping_,
        id_mapping=id_mapping,
    )

    with transaction(db):
        try:
            metadata_df = validate_dimension_type_metadata(
                sample_type_in.metadata_file,
                sample_type_in.annotation_type_mapping,
                sample_type_in.name,
                sample_type.id_column,
            )
        except UserError as e:
            log.error(e)
            raise e

        _id_mapping = cast(Optional[Dict[str, str]], sample_type_in.id_mapping)
        if _id_mapping is not None:
            check_id_mapping_is_valid(db, _id_mapping)

        # hack: this endpoint is going away so for the time being and we don't have continous values in our
        # metadata at this time, don't worry about the units -- but not providing units causes an assert later
        units_per_column = {
            column_name: "value" for column_name in annotation_type_mapping_
        }

        updated_sample_type = dataset_service.update_dimension_type_metadata(
            db,
            user,
            settings.filestore_location,
            sample_type,
            metadata_file.filename,
            metadata_df,
            annotation_type_mapping_,
            taiga_id,
            reference_column_mappings=(
                None
                if not sample_type_in.id_mapping
                else sample_type_in.id_mapping["reference_column_mappings"]
            ),
            properties_to_index=properties_to_index,
            units_per_column=units_per_column,
        )

    return updated_sample_type


@router.patch(
    "/feature/{feature_type_name}/metadata",
    operation_id="update_feature_type_metadata",
    response_model=FeatureTypeOut,
    response_model_exclude_none=True,
    deprecated=True,
)
def update_feature_type_metadata(
    feature_type_name: str,
    metadata_file: UploadFile = File(...),
    taiga_id: str = Form(None),
    annotation_type_mapping: Union[Json[AnnotationTypeMap], None] = Body(None),
    id_mapping: Union[Json[IdMappingInsanity], None] = Body(
        default=None,
        description="A mapping of dataset column names to the feature type name those columns reference.",
    ),
    properties_to_index: List[str] = Form(
        description="A list of columns by name to add to the dimension search index.",
        default_factory=lambda: [],
    ),
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
    settings: Settings = Depends(get_settings),
):
    if feature_type_name == "generic":
        raise HTTPException(400, "Cannot add metadata to feature type 'generic'.")
    if user not in settings.admin_users:
        raise HTTPException(
            403, f"User: {user} do not have permission to update the metadata."
        )
    feature_type = type_crud.get_dimension_type(db, feature_type_name)
    if feature_type is None:
        raise HTTPException(404, f"Feature type {feature_type_name} not found!")
    if metadata_file is None:
        raise HTTPException(400, f"Feature type metadata needs a 'metadata_file'.")

    annotation_type_mapping_: Dict[str, AnnotationType] = {}
    if annotation_type_mapping is not None:
        annotation_type_mapping_ = annotation_type_mapping.annotation_type_mapping

    if isinstance(id_mapping, IdMappingInsanity):
        id_mapping = id_mapping.id_mapping

    assert isinstance(id_mapping, IdMapping) or id_mapping is None
    reference_column_mappings: Dict[str, str] = {}
    if id_mapping is not None:
        reference_column_mappings = id_mapping.reference_column_mappings

    # always create a new dataset ID when the data changes
    # note: This is leaking datasets. This is a short term issue, as we want to replace these endpoints
    # with a more general "dimension" endpoint and can manually clean up these datasets

    with transaction(db):
        metadata_df = validate_dimension_type_metadata(
            metadata_file,
            annotation_type_mapping_,
            feature_type.name,
            feature_type.id_column,
        )

        check_id_mapping_is_valid(db, reference_column_mappings)

        # hack: this endpoint is going away so for the time being and we don't have continous values in our
        # metadata at this time, don't worry about the units -- but not providing units causes an assert later
        units_per_column = {
            column_name: "value" for column_name in annotation_type_mapping_
        }

        updated_feature_type = dataset_service.update_dimension_type_metadata(
            db,
            user,
            settings.filestore_location,
            feature_type,
            metadata_file.filename,
            metadata_df,
            annotation_type_mapping_,
            taiga_id,
            reference_column_mappings,
            properties_to_index,
            units_per_column=units_per_column,
        )

    return updated_feature_type


@router.delete(
    "/sample/{sample_type}", operation_id="remove_sample_type", deprecated=True
)
def delete_sample_type(
    sample_type: str,
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
    settings: Settings = Depends(get_settings),
):
    """Delete a sample type, if the user is an admin."""
    if user not in settings.admin_users:
        raise HTTPException(
            403, "You do not have permission to delete the sample type."
        )

    dim_sample_type = type_crud.get_dimension_type(db, sample_type)
    if dim_sample_type is None:
        raise HTTPException(404, "Sample type not found")
    datasets_with_sample_type = get_datasets(db, user, sample_type=sample_type)
    num_datasets = len(datasets_with_sample_type)
    remaining_dataset_is_dim_type_metadata = (num_datasets == 1) and (
        datasets_with_sample_type[0].id == dim_sample_type.dataset_id
    )
    if num_datasets > 0 and not remaining_dataset_is_dim_type_metadata:
        raise HTTPException(
            409,
            f"There {'is' if num_datasets == 1 else 'are'} {num_datasets} dataset{'s' if num_datasets > 1 else ''} with this sample type! Please delete {'it' if num_datasets == 1 else 'them'} first before proceeding to delete {sample_type} sample type.",
        )
    with transaction(db):
        if type_crud.delete_dimension_type(db, dim_sample_type):
            return {"message": f"Deleted {dim_sample_type.name}"}
    raise HTTPException(400)


@router.delete(
    "/feature/{feature_type}", operation_id="remove_feature_type", deprecated=True
)
def delete_feature_type(
    feature_type: str,
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
    settings: Settings = Depends(get_settings),
):
    """Delete a feature type, if the user is an admin."""
    if user not in settings.admin_users:
        raise HTTPException(
            403, "You do not have permission to delete the dimension type."
        )

    dim_feature_type = type_crud.get_dimension_type(db, feature_type)
    if dim_feature_type is None:
        raise HTTPException(404, "Dimension type not found")
    datasets_with_feature_type = get_datasets(db, user, feature_type=feature_type)
    num_datasets = len(datasets_with_feature_type)
    remaining_dataset_is_dim_type_metadata = (num_datasets == 1) and (
        datasets_with_feature_type[0].id == dim_feature_type.dataset_id
    )
    if num_datasets > 0 and not remaining_dataset_is_dim_type_metadata:
        raise HTTPException(
            409,
            f"There {'is' if num_datasets == 1 else 'are'} {num_datasets} dataset{'s' if num_datasets > 1 else ''} with this feature type! Please delete {'it' if num_datasets == 1 else 'them'} first before proceeding to delete {feature_type} feature type.",
        )
    with transaction(db):
        if type_crud.delete_dimension_type(db, dim_feature_type):
            return {"message": f"Deleted {dim_feature_type.name}"}
    raise HTTPException(400)


######### new dimension type endpoints


@router.post(
    "/dimensions", operation_id="add_dimension_type", response_model=DimensionType
)
def add_dimension_type_endpoint(
    dimension_type: AddDimensionType,
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
    settings: Settings = Depends(get_settings),
):
    """Add a either a sample or feature type"""

    existing_dimension_type = type_crud.get_dimension_type(db, dimension_type.name)
    if existing_dimension_type is not None:
        raise HTTPException(
            400,
            f"Dimension type {dimension_type.name} already exists as a {existing_dimension_type.axis} type!",
        )

    assert_is_admin_user(user, settings)

    with transaction(db):
        result = dataset_service.add_dimension_type(
            db,
            settings,
            user,
            name=dimension_type.name,
            display_name=dimension_type.display_name,
            id_column=dimension_type.id_column,
            axis=dimension_type.axis,
        )

        return _dim_type_to_response(result)


@router.get(
    "/dimensions/{name}",
    operation_id="get_dimension_type",
    response_model=DimensionType,
)
def get_dimension_type_endpoint(
    name: str, db: SessionWithUser = Depends(get_db_with_user),
):
    existing_type = type_crud.get_dimension_type(db, name)
    if existing_type is None:
        raise HTTPException(404, "Dimension type not found")
    return _dim_type_to_response(existing_type)


@router.get(
    "/dimensions",
    operation_id="get_dimension_types",
    response_model=List[DimensionType],
)
def list_dimension_types_endpoint(db: SessionWithUser = Depends(get_db_with_user),):
    dim_types = type_crud.get_dimension_types(db)
    return [_dim_type_to_response(x) for x in dim_types]


@router.get(
    "/dimensions/{name}/identifiers",
    operation_id="get_dimension_type_identifiers",
    response_model=List[DimensionIdentifiers],
)
def get_dimension_type_identifiers(
    name: str,
    data_type: Annotated[Union[str, None], Query()] = None,
    show_only_dimensions_in_datasets: Annotated[bool, Query()] = False,
    db: SessionWithUser = Depends(get_db_with_user),
):
    dim_type = type_crud.get_dimension_type(db, name)
    if dim_type is None:
        raise HTTPException(404, f"Dimension type {name} not found")

    dimension_ids_and_labels = metadata_service.get_dimension_type_identifiers(
        db, dim_type, data_type, show_only_dimensions_in_datasets
    )

    return [
        DimensionIdentifiers(id=id, label=label)
        for id, label in dimension_ids_and_labels.items()
    ]


@router.patch(
    "/dimensions/{name}",
    operation_id="update_dimension_type",
    response_model=DimensionType,
)
def update_dimension_type_endpoint(
    name: str,
    dimension_type_update: UpdateDimensionType,
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
    settings: Settings = Depends(get_settings),
):
    assert_is_admin_user(user, settings)

    dimension_type = type_crud.get_dimension_type(db, name)
    if dimension_type is None:
        raise ResourceNotFoundError(f"Dimension type {name} not found")

    with transaction(db):
        dataset_service.update_dimension_type(
            db, user, settings.filestore_location, dimension_type, dimension_type_update
        )

        updated = type_crud.get_dimension_type(db, name)
        return _dim_type_to_response(updated)


def _dim_type_to_response(type: DimensionTypeModel):
    properties_to_index = []
    if type.dataset is not None:
        properties_to_index = [x.property for x in type.properties_to_index]

    return DimensionType(
        name=type.name,
        display_name=type.display_name,
        id_column=type.id_column,
        axis=type.axis,
        metadata_dataset_id=type.dataset_id,
        properties_to_index=properties_to_index,
    )


@router.delete(
    "/dimensions/{name}", operation_id="remove_dimension_type",
)
def delete_dimension_type_endpoint(
    name: str,
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
    settings: Settings = Depends(get_settings),
):
    """Delete a feature type, if the user is an admin."""
    assert_is_admin_user(user, settings)

    dim_feature_type = type_crud.get_dimension_type(db, name)
    if dim_feature_type is None:
        raise HTTPException(404, "Dimension type not found")

    datasets_with_using_type: List[Dataset] = list(
        get_datasets(db, user, feature_type=name)
    ) + list(get_datasets(db, user, sample_type=name))

    # don't count datasets which are actually the metadata for this type
    datasets_with_using_type = [
        x for x in datasets_with_using_type if x.id != dim_feature_type.dataset_id
    ]

    num_datasets = len(datasets_with_using_type)
    if num_datasets > 0:
        dataset_names = [x.name for x in datasets_with_using_type]
        raise HTTPException(
            409,
            f"Cannot delete dimension type named \"{name}\" because it is referenced by the following dataset(s): {', '.join(dataset_names)}",
        )

    with transaction(db):
        if type_crud.delete_dimension_type(db, dim_feature_type):
            return {"message": f"Deleted {dim_feature_type.name}"}

    raise HTTPException(400)
