from __future__ import annotations
from uuid import UUID
from datetime import date
from typing import Optional, List, Annotated
from pydantic import BaseModel, Field, field_validator, ConfigDict


class ReleasePipelineSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    pipeline_name: Annotated[str, Field(description="Name of the pipeline used")]


class ReleaseFileSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    file_name: Annotated[str, Field(description="The name of the file when downloaded")]
    datatype: Annotated[str, Field(description="The type of data, e.g., 'crispr'")]
    size: Annotated[
        Optional[str], Field(description="Human readable size, e.g. '1.2GB'")
    ] = None
    description: Annotated[
        Optional[str], Field(description="Optional file description")
    ] = None
    bucket_url: Annotated[
        Optional[str],
        Field(description="Google Storage path. If null, file is retracted."),
    ] = None
    taiga_id: Annotated[Optional[str], Field(description="Taiga ID")] = None
    canonical_taiga_id: Annotated[
        Optional[str], Field(description="Canonical Taiga ID")
    ] = None
    md5_hash: Annotated[
        Optional[str],
        Field(max_length=32, min_length=32, description="MD5 hash of the file"),
    ] = None
    version: Annotated[Optional[int], Field(description="File version number")] = None
    pipeline_name: Annotated[
        Optional[str],
        Field(description="Name of the specific pipeline that generated this file"),
    ] = None
    is_main_file: Annotated[
        bool,
        Field(
            description="Whether this is a primary or supplemental file for the release"
        ),
    ] = False


class ReleaseVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    version_name: Annotated[
        str,
        Field(
            description="Name of the specific release version, e.g. DepMap Public 2XQ1"
        ),
    ]
    release_name: Annotated[
        str,
        Field(description="Display/Grouping name of the release, e.g. DepMap Public"),
    ]
    content_hash: Annotated[
        str, Field(min_length=32, max_length=32, description="MD5 fingerprint")
    ]
    version_date: Annotated[
        date, Field(description="Date the release version was published")
    ]
    description: Annotated[
        Optional[str], Field(description="Long form description")
    ] = None
    citation: Annotated[
        Optional[str], Field(description="Citable reference for the data")
    ] = None
    funding: Annotated[
        Optional[str], Field(description="Funding source information")
    ] = None
    terms: Annotated[
        Optional[str], Field(description="Terms of use and embargo text")
    ] = None
    data_type: Annotated[str, Field(description="e.g. 'crispr'")]

    files: Annotated[List[ReleaseFileSchema], Field(default_factory=list)]
    pipelines: Annotated[List[ReleasePipelineSchema], Field(default_factory=list)]


class CreateReleaseVersionParams(BaseModel):
    version_name: Annotated[
        str,
        Field(
            min_length=1,
            description="Name of the specific release version (e.g. DepMap Public 2XQ1)",
        ),
    ]
    release_name: Annotated[
        str,
        Field(
            min_length=1,
            description="Name of the release grouping (e.g. DepMap Public). More general than name. Can be associated with multiple release versions.",
        ),
    ]
    version_date: Annotated[date, Field(default_factory=date.today)]
    description: Optional[str] = None
    citation: Optional[str] = None
    funding: Optional[str] = None
    terms: Optional[str] = None
    data_type: Annotated[str, Field(description="e.g. 'crispr'")]

    file_ids: Annotated[
        List[UUID], Field(description="List of file UUIDs to attach to this release")
    ] = []

    content_hash: Annotated[
        str, Field(min_length=32, max_length=32, description="MD5 fingerprint")
    ]

    @field_validator("content_hash")
    def check_hex(cls, v):
        try:
            int(v, 16)
            return v
        except ValueError:
            raise ValueError(
                "content_hash must be a valid 32-character hexadecimal string"
            )
