from __future__ import annotations
from uuid import UUID
from typing import Optional, List, Dict, Any, Annotated, Union, Literal
from pydantic import AfterValidator, BaseModel, Field, model_validator, field_validator

from breadbox.schemas.common import DBBase
from fastapi import Body
from breadbox.schemas.custom_http_exception import UserError
from .group import Group
import enum

from depmap_compute.slice import SliceQuery


# NOTE: Using multivalue Literals seems to be creating errors in pydantic models and fastapi request params.
# It is possible that for our version of pydantic, the schema for Literals is messed up
# (see: https://github.com/tiangolo/fastapi/issues/562).
# Upgrading the pydantic version could potentially solve this issue
class FeatureSampleIdentifier(enum.Enum):
    id = "id"
    label = "label"


class ValueType(enum.Enum):
    continuous = "continuous"
    categorical = "categorical"


class AnnotationType(enum.Enum):
    continuous = "continuous"
    categorical = "categorical"
    binary = "binary"
    text = "text"
    list_strings = "list_strings"


class SliceQueryIdentifierType(enum.Enum):
    # Only used because Pyright doesn't work well with the literal types we use elsewhere.
    feature_id = "feature_id"
    feature_label = "feature_label"
    sample_id = "sample_id"
    sample_label = "sample_label"
    column = "column"


# NOTE: `param: Annotated[Optional[str], Field(None)]` gives pydantic error 'ValueError: `Field` default cannot be set in `Annotated` for 'param''.
# `param: Annotated[Optional[str], Field()] = None` solves the default issue
# According to https://github.com/pydantic/pydantic/issues/8118 this issue is only in Pydantic V1.10 not V2.0.
# NOTE: Optional typing (not in Annotated) is still parsed as required in openapi.json
# NOTE: fastapi versions >= V0.100.0 supports Pydantic V2
class SharedDatasetParams(BaseModel):
    name: Annotated[str, Field(description="Name of dataset", min_length=1)]
    short_name: Annotated[
        Optional[str], Field(description="an optional short label describing dataset")
    ] = None
    description: Annotated[
        Optional[str], Field(description="an optional long description of the dataset")
    ] = None
    version: Annotated[
        Optional[str], Field(description="an optional short version identifier")
    ] = None
    file_ids: Annotated[
        List[str],
        Field(description="Ordered list of file ids from the chunked dataset uploads"),
    ]
    dataset_md5: Annotated[
        str,
        Field(
            max_length=32, min_length=32, description="MD5 hash for entire dataset file"
        ),
    ]
    data_type: Annotated[str, Field(description="Data type grouping for your dataset")]
    group_id: Annotated[
        UUID,
        Field(
            description=f"ID of the group the dataset belongs to. Required for non-transient datasets. The public group is `00000000-0000-0000-0000-000000000000`"
        ),
    ]
    given_id: Annotated[
        Optional[str],
        Field(
            description="Stable human-readable identifier that the portal uses to look up specific datasets."
        ),
    ] = None
    priority: Annotated[
        Optional[int],
        Field(
            description="Numeric value assigned to the dataset with `1` being highest priority within the `data_type`, used for displaying order of datasets to show for a specific `data_type` in UI.",
            gt=0,  # Greater than 0
            default=None,
        ),
    ] = None
    taiga_id: Annotated[
        Optional[str], Field(description="Taiga ID the dataset is sourced from.",),
    ] = None
    is_transient: Annotated[
        bool,
        Field(
            description="Transient datasets can be deleted - should only be set to true for non-public short-term-use datasets like custom analysis results.",
        ),
    ] = False
    dataset_metadata: Annotated[
        Optional[Dict[str, Any]],
        Body(
            description="Contains a dictionary of additional dataset values that are not already provided above.",
        ),
    ] = None  # NOTE: Error if put default value in Body(). Strangely, setting typing to Annotated[Optional[...]] correctly outputs in openapi.json as unrequired param but not in other cases?

    @field_validator("dataset_md5")
    def check_hexadecimal(cls, v):
        try:
            int(v, 16)
            return v
        except:
            raise ValueError("Must be hex string")


class MatrixDatasetParams(SharedDatasetParams):
    format: Literal["matrix"]
    units: Annotated[
        str, Field(description="Units for the values in the dataset, used for display")
    ]
    feature_type: Annotated[
        Optional[str], Field(description="Type of features your dataset contains",),
    ] = None
    sample_type: Annotated[
        str, Field(description="Type of samples your dataset contains",),
    ]
    value_type: Annotated[
        ValueType,
        Field(
            description="Value 'continuous' if dataset contains numerical values or 'categorical' if dataset contains string categories as values.",
        ),
    ]
    allowed_values: Annotated[
        Optional[List[str]],
        Field(
            description="Only provide if 'value_type' is 'categorical'. Must contain all possible categorical values",
        ),
    ] = None

    data_file_format: Annotated[
        Literal["csv", "parquet"],
        Field(
            description="The format of the uploaded data file. May either be 'csv' or 'parquet'"
        ),
    ] = "csv"

    @model_validator(mode="after")
    def check_feature_and_sample_type(self):
        feature_type, sample_type = (self.feature_type, self.sample_type)
        if (
            feature_type is not None
            and sample_type is not None
            and feature_type == sample_type
        ):
            raise ValueError("Sample type and feature type cannot be the same!")

        if feature_type is None and sample_type is None:
            raise ValueError("Must include either sample type or feature type!")

        return self

    @model_validator(mode="after")
    def check_valid_value_type_with_allowed_values(self):
        value_type, allowed_values = (
            self.value_type,
            self.allowed_values,
        )
        if allowed_values is not None and value_type != ValueType.categorical:
            raise ValueError(
                "Only categorical value type datasets can have allowed_values!"
            )

        if allowed_values is None and value_type == ValueType.categorical:
            raise ValueError(
                "Must include allowed_values for categorical value type datasets!"
            )
        return self

    @field_validator("allowed_values", mode="after")
    @classmethod
    def check_valid_allowed_values(cls, v: Optional[List[str]]):
        """
        Checks there are no empty strings and no repeated allowed values. Values in allowed values list are not case-sensitive.
        """
        if v is None:
            return v
        # Decision to make allowed values not case-sensitive in case user error in accidental repeats
        allowed_values_list_lower = [str(x).lower() for x in v]
        allowed_values_set = set(allowed_values_list_lower)
        print(allowed_values_set, allowed_values_list_lower)
        if len(allowed_values_set) != len(v):
            raise UserError(
                msg="Make sure there are no repeats in allowed_values. Values are not considered case-sensitive",
            )
        for val in allowed_values_set:
            if val == "":
                raise UserError("Empty strings are not allowed!")
        return v


class ColumnMetadata(BaseModel):
    units: Annotated[
        Optional[str],
        Field(description="Units for the values in the column, used for display",),
    ] = None

    col_type: Annotated[
        AnnotationType,
        Field(
            description="Annotation type for the column. Annotation types may include: `continuous`, `categorical`, `binary`, `text`, or `list_strings`."
        ),
    ]

    references: Annotated[
        Optional[str],
        Field(
            description="If specified, the value in this column is interpreted as an IDs in the named dimension type.",
        ),
    ] = None

    @model_validator(mode="after")
    def check_columns_metadata_continuous_units(self):
        units, col_type = self.units, self.col_type
        if units is None and col_type == AnnotationType.continuous:
            raise UserError("Column type of continuous must include units!")

        return self


class TableDatasetParams(SharedDatasetParams):
    format: Literal["tabular"]
    index_type: Annotated[
        str,
        Field(
            description="Feature type or sample type name that is used as index in the table dataset format. Used to validate the identifier of the dimension type is included in the dataset."
        ),
    ]

    columns_metadata: Annotated[
        Dict[str, ColumnMetadata],
        Field(
            description="Dictionary containing info about each column in the table dataset format."
        ),
    ]


DatasetParams = Annotated[
    Union[MatrixDatasetParams, TableDatasetParams], Field(discriminator="format")
]


class DatasetMetadata(BaseModel):
    dataset_metadata: Dict[str, Any]  # value is anything that can be jsonified


def check_uuid(id: str) -> str:
    try:
        UUID(id)
        return id
    except:
        raise ValueError("Id must be a string in UUID4 format!")


class SharedDatasetFields(BaseModel):
    name: str
    short_name: Annotated[
        Optional[str], Field(description="an optional short label describing dataset")
    ] = None
    description: Annotated[
        Optional[str], Field(description="an optional long description of the dataset")
    ] = None
    version: Annotated[
        Optional[str], Field(description="an optional short version identifier")
    ] = None
    data_type: str
    group_id: str
    given_id: Annotated[Optional[str], Field(default=None)]
    priority: Annotated[Optional[int], Field(default=None, gt=0,)]
    taiga_id: Annotated[Optional[str], Field(default=None,)]
    is_transient: Annotated[bool, Field(default=False,)]
    dataset_metadata: Annotated[
        Optional[Dict[str, Any]], Field()
    ]  # NOTE: Same as Dict[str, Any] =  Field(None,)
    dataset_md5: Annotated[Optional[str], Field(None, max_length=32, min_length=32,)]
    # field_validator
    _check_uuid = field_validator("group_id")(check_uuid)


class MatrixDatasetBase(SharedDatasetFields):
    format: Literal["matrix_dataset"] = "matrix_dataset"
    sample_type_name: str
    units: str
    value_type: ValueType
    feature_type_name: Optional[str] = Field()
    allowed_values: Optional[List[str]] = Field()


class MatrixDatasetIn(MatrixDatasetBase):
    id: str

    # field_validator
    _check_uuid = field_validator("id")(check_uuid)


class MatrixDatasetResponse(MatrixDatasetBase, DBBase):
    group: Group


class TabularDatasetBase(SharedDatasetFields):
    format: Literal["tabular_dataset"] = "tabular_dataset"
    index_type_name: Optional[str]


class TabularDatasetResponse(TabularDatasetBase, DBBase):
    group: Group
    columns_metadata: Annotated[
        Dict[str, ColumnMetadata],
        Field(
            description="Dictionary containing info about each column in the table dataset format."
        ),
    ]


DatasetResponse = Annotated[
    Union[MatrixDatasetResponse, TabularDatasetResponse], Field(discriminator="format"),
]


MatrixDatasetResponse.model_rebuild()
TabularDatasetResponse.model_rebuild()


class TabularDatasetIn(TabularDatasetBase):
    id: str

    # field_validator
    _check_uuid = field_validator("id")(check_uuid)


class AddDatasetResponse(BaseModel):
    state: str
    id: str
    message: Optional[str] = Field(default=None,)
    result: Optional[dict] = Field(default=None,)
    percentComplete: Optional[int] = Field(default=None,)


class UploadFields(BaseModel):
    file_ids: List[str]
    dataset_md5: str


class UnknownIDs(BaseModel):
    dimensionType: str
    axis: str
    IDs: List[str]


class UploadDatasetResponse(BaseModel):
    datasetId: str
    dataset: DatasetResponse
    warnings: List[str]
    forwardingUrl: Optional[str] = Field()


class UploadDatasetResponseV2(BaseModel):
    datasetId: str
    dataset: DatasetResponse
    unknownIDs: List[UnknownIDs]


class TabularDimensionsInfo(BaseModel):
    indices: Annotated[
        Optional[List[str]],
        Field(
            description="Dimension indices to subset the dataset by. If None, return all the indices in the dataset",
        ),
    ] = None
    identifier: Annotated[
        Optional[FeatureSampleIdentifier],
        Field(
            description="Specifies whether the indices given are dimension ids or their labels",
        ),
    ] = None
    columns: Annotated[
        Optional[List[str]],
        Field(
            description="Column names in the table to include in subsetted data. If None, return all columns",
        ),
    ] = None

    @model_validator(mode="after")
    def check_indices(self):
        indices, identifier = self.indices, self.identifier
        if indices is not None and identifier is None:
            raise UserError(
                "Must specify whether `identifier` for given `indices` is 'id' or 'label'"
            )
        return self


class MatrixDimensionsInfo(BaseModel):
    features: Annotated[
        Optional[List[str]],
        Field(
            description="List of feature labels or ids for which data should be retrieved"
        ),
    ] = None
    feature_identifier: Annotated[
        Optional[FeatureSampleIdentifier],
        Field(
            description="Denotes whether the list of features are given as ids or feature labels"
        ),
    ] = None
    samples: Annotated[
        Optional[List[str]],
        Field(
            description="List of sample labels or ids for which data should be retrieved"
        ),
    ] = None
    sample_identifier: Annotated[
        Optional[FeatureSampleIdentifier],
        Field(
            description="Denotes whether the list of samples are given as ids or sample labels"
        ),
    ] = None

    @model_validator(mode="after")
    def check_valid_values(self):
        features, feature_identifier, samples, sample_identifier = (
            self.features,
            self.feature_identifier,
            self.samples,
            self.sample_identifier,
        )
        if features is not None and feature_identifier is None:
            raise UserError(
                "Must specify `feature_identifier` for whether the list of provided `features` are formatted as features' 'id' or 'label'"
            )
        elif samples is not None and sample_identifier is None:
            raise UserError(
                "Must specify `sample_identifier` for whether the list of provided `samples` are formatted as samples' 'id' or 'label'"
            )
        else:
            return self


class FeatureResponse(BaseModel):
    feature_id: str
    dataset_id: str
    values: Dict[str, Any]
    label: str
    units: str
    dataset_label: str


class DatasetUpdateSharedParams(BaseModel):
    """Contains the shared subset of matrix and tabular dataset fields that may be updated after dataset creation."""

    name: Annotated[Optional[str], Field(description="Name of dataset")] = None
    short_name: Annotated[
        Optional[str], Field(description="an optional short label describing dataset")
    ] = None
    description: Annotated[
        Optional[str], Field(description="an optional long description of the dataset")
    ] = None
    version: Annotated[
        Optional[str], Field(description="an optional short version identifier")
    ] = None
    data_type: Annotated[
        Optional[str], Field(description="Data type grouping for your dataset")
    ] = None
    group_id: Annotated[
        Optional[UUID], Field(description="Id of the group the dataset belongs to")
    ] = None
    priority: Annotated[
        Optional[int],
        Field(
            description="Numeric value representing priority of the dataset within its `data_type`"
        ),
    ] = None
    dataset_metadata: Annotated[
        Optional[Dict[str, Any]],
        Field(
            description="A dictionary of additional dataset metadata that is not already provided"
        ),
    ] = None
    given_id: Annotated[
        Optional[str], Field(description="The 'given ID' for this dataset")
    ] = None


class TabularDatasetUpdateParams(DatasetUpdateSharedParams):
    """Tabular dataset parameters that are editable"""

    format: Literal["tabular"]


class MatrixDatasetUpdateParams(DatasetUpdateSharedParams):
    """Matrix dataset parameters that are editable"""

    format: Literal["matrix"]
    units: Annotated[
        Optional[str], Field(description="Units for the values in the dataset")
    ] = None


UpdateDatasetParams = Annotated[
    Union[MatrixDatasetUpdateParams, TabularDatasetUpdateParams],
    Field(discriminator="format"),
]


class NameAndID(BaseModel):
    name: str
    id: str


class DimensionSearchIndexResponse(BaseModel):
    type_name: str
    id: str
    label: str
    matching_properties: List[Dict[str, str]]
    referenced_by: Optional[List[NameAndID]]


class DimensionDataResponse(BaseModel):
    ids: list[str]
    labels: list[str]
    values: list[Any]
