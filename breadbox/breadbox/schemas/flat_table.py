from enum import Enum
from typing import Annotated, Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

GIVEN_ID_PATTERN = "^[A-Za-z0-9_.-]+$"


class ColumnType(str, Enum):
    string = "string"
    int = "int"
    float = "float"


class FlatTableColumnMetadata(BaseModel):
    given_id: Annotated[
        str,
        Field(
            pattern=GIVEN_ID_PATTERN,
            description="how the column is named in the uploaded file",
        ),
    ]
    name: Annotated[str, Field(description="Name of the column for display purposes")]
    references: Annotated[
        Optional[str],
        Field(
            description="If set, indicates this column's values are IDs in the named Dimension type. Metadata only -- breadbox does not resolve or otherwise interpret it.",
        ),
    ] = None
    type: Annotated[
        ColumnType, Field(description="What type to expect the values to be")
    ]


class FlatTableCreateParams(BaseModel):
    given_id: Annotated[
        str,
        Field(
            pattern=GIVEN_ID_PATTERN,
            description="Stable human-readable identifier for the *current* version of this table. See given_id semantics.",
        ),
    ]
    name: Annotated[str, Field(description="Name of the table for display purposes")]
    file_ids: Annotated[
        List[str],
        Field(
            description="Ordered list of file ids from the chunked flat table uploads"
        ),
    ]
    file_md5: Annotated[
        str,
        Field(
            max_length=32,
            min_length=32,
            description="MD5 hash for the entire uploaded file",
        ),
    ]
    file_format: Annotated[
        Literal["parquet"],
        Field(
            description="Format of the uploaded file. Currently only parquet is supported."
        ),
    ] = "parquet"
    taiga_id: Annotated[
        Optional[str],
        Field(description="The taiga ID that this table was sourced from"),
    ] = None
    metadata: Annotated[
        Optional[Dict[str, Any]],
        Field(
            description="An arbitrary set of key value pairs attached to this instance."
        ),
    ] = None
    columns: Annotated[
        List[FlatTableColumnMetadata],
        Field(description="The list of columns contained within the uploaded file."),
    ]
    indices: Annotated[
        List[List[str]],
        Field(
            description="Sets of columns which should have a SQLite index built on them, purely as a performance optimization for subset queries."
        ),
    ] = Field(default_factory=list)

    @field_validator("file_md5")
    def check_hexadecimal(cls, v):
        try:
            int(v, 16)
        except ValueError:
            raise ValueError("Must be hex string")
        return v

    @model_validator(mode="after")
    def check_columns_and_indices(self):
        given_ids = [c.given_id for c in self.columns]
        if len(given_ids) != len(set(given_ids)):
            raise ValueError("Duplicate column given_id values are not allowed")

        column_given_ids = set(given_ids)
        for index_columns in self.indices:
            for column in index_columns:
                if column not in column_given_ids:
                    raise ValueError(f"`indices` references unknown column {column!r}")

        return self


class FlatTableUpdateParams(BaseModel):
    given_id: Annotated[
        Optional[str],
        Field(
            pattern=GIVEN_ID_PATTERN,
            description="Reassign this table's given_id. If another current flat table already holds that given_id, it is superseded.",
        ),
    ] = None
    name: Annotated[
        Optional[str], Field(description="Name of the table for display purposes")
    ] = None


class FlatTableResponse(BaseModel):
    flat_table_id: str
    given_id: Optional[str] = None
    name: str
    row_count: int
    taiga_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    columns: List[FlatTableColumnMetadata]


class FlatTableSummaryResponse(BaseModel):
    flat_table_id: str
    given_id: Optional[str] = None
    name: str
    row_count: int
    taiga_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class FlatTableFilter(BaseModel):
    column: Annotated[str, Field(description="The column to check")]
    values: Annotated[
        List[str],
        Field(
            description="The row satisfies this filter if it has any of the values listed"
        ),
    ]


class FlatTableSubsetRequest(BaseModel):
    flat_table_id: Annotated[
        str,
        Field(
            description="either the given_id or the flat_table_id UUID; resolves to the current version if given_id"
        ),
    ]
    filters: Annotated[
        List[FlatTableFilter],
        Field(
            description="The filters which must ALL be satisfied by each returned row"
        ),
    ] = Field(default_factory=list)
    columns: Annotated[
        Optional[List[str]],
        Field(
            description="The columns to return in the response. If omitted, all columns will be returned."
        ),
    ] = None


class FlatTableSubsetColumn(BaseModel):
    metadata: FlatTableColumnMetadata
    values: List[Any]


class FlatTableSubsetResponse(BaseModel):
    columns: List[FlatTableSubsetColumn]
    row_count: int
