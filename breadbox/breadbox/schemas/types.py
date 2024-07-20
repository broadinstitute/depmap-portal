from typing import Optional, Dict, Any, Literal
from breadbox.models.dataset import AnnotationType
from breadbox.schemas.custom_http_exception import AnnotationValidationError
from breadbox.schemas.dataset import TabularDatasetResponse
from fastapi import File, Form, HTTPException, UploadFile, Body

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Annotated
import json


class IdAndName(BaseModel):
    id: str
    name: str


class DimensionType(BaseModel):
    name: str
    id_column: str
    axis: Literal["feature", "sample"]
    properties_to_index: Optional[List[str]] = Field(None,)
    metadata_dataset_id: Optional[str] = Field(None,)


class AddDimensionType(BaseModel):
    name: str
    id_column: str
    axis: Literal["feature", "sample"]


class UpdateDimensionType(BaseModel):
    # cannot update name, id_column, nor axis
    metadata_dataset_id: str
    properties_to_index: List[str]


# class DimensionTypeIn(DimensionType):
#     metadata_file_ids: List[str]
#
#
# class DimensionTypeOut(DimensionType):
#     dataset: IdAndName


class FeatureTypeOut(BaseModel):
    class Config:
        orm_mode = True
        allow_population_by_field_name = True

    name: str
    id_column: str
    dataset: Annotated[Optional[TabularDatasetResponse], Field(None,)]


class SampleTypeOut(BaseModel):
    class Config:
        orm_mode = True
        allow_population_by_field_name = True

    name: str
    id_column: str
    dataset: Annotated[Optional[TabularDatasetResponse], Field(None,)]


class MetadataType(BaseModel):
    name: str = Field(min_length=1)
    id_column: str = Field(min_length=1)
    axis: Literal["feature", "sample"]


class AnnotationTypeMap(BaseModel):
    annotation_type_mapping: Dict[str, AnnotationType]


class MetadataMapping(BaseModel):
    metadata_file: UploadFile = File(None)
    annotation_type_mapping: Optional[Dict[str, AnnotationType]] = Body(None)
    id_mapping: Optional[Dict[str, Any]] = Body(None)

    @validator("metadata_file")
    def check_metadata_file_content_type(cls, metadata_value: Optional[UploadFile]):
        if metadata_value and metadata_value.content_type != "text/csv":
            raise HTTPException(
                400,
                detail=f"Invalid document type for 'metadata_file'. Expected 'text/csv/' but got {metadata_value.content_type}",
            )
        return metadata_value

    @validator("annotation_type_mapping")
    def check_annotation_type_mapping_provided(
        cls,
        annotation_type_mapping_val: Optional[Dict[str, AnnotationType]],
        values: Dict[str, Any],
    ) -> Optional[Dict[str, AnnotationType]]:

        if values.get("metadata_file") is not None:
            if annotation_type_mapping_val is None:
                raise AnnotationValidationError(
                    "Annotation type mapping must be provided if metadata file is provided!"
                )

        else:
            if annotation_type_mapping_val is not None:
                raise AnnotationValidationError(
                    "Annotation type mapping can only be provided when metadata file is provided"
                )
        return annotation_type_mapping_val


class TypeMetadataIn(MetadataType, MetadataMapping):
    taiga_id: Optional[str]

    @validator("id_column")
    def check_annotation_type_for_id_col_is_string(
        cls, id_col_val: str, values: Dict[str, Any]
    ):
        # Unsure why 'id_column' gets checked after 'annotation_type_mapping
        annotation_type_map = values.get("annotation_type_mapping")
        if annotation_type_map is not None:
            if id_col_val not in annotation_type_map:
                raise AnnotationValidationError(
                    f"Annotation type mapping should include the id column '{id_col_val}' and be of type 'text'!"
                )
            if annotation_type_map[id_col_val] != AnnotationType.text:
                raise AnnotationValidationError(
                    f"Annotation type for the id column '{id_col_val}' should be of type 'text'!"
                )
        return id_col_val

    @validator("taiga_id")
    def check_taiga_id_with_metadata_file(cls, taiga_val: str, values: Dict[str, Any]):
        metadata_file = values.get("metadata_file")
        if metadata_file is None and taiga_val is not None:
            raise AnnotationValidationError("Need metadata file if providing taiga id!")


class IdMapping(BaseModel):
    reference_column_mappings: Dict[str, str]


class IdMappingInsanity(BaseModel):
    """This class exists for copying with some oddities in how the id_mapping parameter is encoded in json. There
    probably would be some better refactoring that would make this all much clearer, however, we've moved away
    from this encoding and plan to delete the endpoints that use this so I'm putting in this hack to keep things
    working until we pull the bandaid off and delete all the depreciated endpoints."""

    id_mapping: IdMapping
