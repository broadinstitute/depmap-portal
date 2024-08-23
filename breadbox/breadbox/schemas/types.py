from typing import Optional, Dict, Any, Literal
from breadbox.models.dataset import AnnotationType
from breadbox.schemas.custom_http_exception import AnnotationValidationError
from breadbox.schemas.dataset import TabularDatasetResponse
from fastapi import File, Form, HTTPException, UploadFile, Body

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Optional, Dict, Annotated


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

    @field_validator("metadata_file")
    def check_metadata_file_content_type(cls, metadata_value: Optional[UploadFile]):
        if metadata_value and metadata_value.content_type != "text/csv":
            raise HTTPException(
                400,
                detail=f"Invalid document type for 'metadata_file'. Expected 'text/csv/' but got {metadata_value.content_type}",
            )
        return metadata_value

    @model_validator(mode="after")
    def check_annotation_type_mapping_provided(self):
        annotation_type_mapping, metadata_file = (
            self.annotation_type_mapping,
            self.metadata_file,
        )

        if metadata_file is not None:
            if annotation_type_mapping is None:
                raise AnnotationValidationError(
                    "Annotation type mapping must be provided if metadata file is provided!"
                )

        else:
            if annotation_type_mapping is not None:
                raise AnnotationValidationError(
                    "Annotation type mapping can only be provided when metadata file is provided"
                )
        return self


class TypeMetadataIn(MetadataType, MetadataMapping):
    taiga_id: Optional[str]

    @model_validator(mode="after")
    def check_annotation_type_for_id_col_is_string(self):
        id_col, annotation_type_map = self.id_column, self.annotation_type_mapping
        if annotation_type_map is not None:
            if id_col not in annotation_type_map:
                raise AnnotationValidationError(
                    f"Annotation type mapping should include the id column '{id_col}' and be of type 'text'!"
                )
            if annotation_type_map[id_col] != AnnotationType.text:
                raise AnnotationValidationError(
                    f"Annotation type for the id column '{id_col}' should be of type 'text'!"
                )
        return self

    @model_validator(mode="after")
    def check_taiga_id_with_metadata_file(self):
        taiga_val, metadata_file = self.taiga_id, self.metadata_file
        if metadata_file is None and taiga_val is not None:
            raise AnnotationValidationError("Need metadata file if providing taiga id!")
        return self


class IdMapping(BaseModel):
    reference_column_mappings: Dict[str, str]


class IdMappingInsanity(BaseModel):
    """This class exists for copying with some oddities in how the id_mapping parameter is encoded in json. There
    probably would be some better refactoring that would make this all much clearer, however, we've moved away
    from this encoding and plan to delete the endpoints that use this so I'm putting in this hack to keep things
    working until we pull the bandaid off and delete all the depreciated endpoints."""

    id_mapping: IdMapping
