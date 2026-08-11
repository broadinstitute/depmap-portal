from pydantic import BaseModel
from typing import Optional


class MatrixSubsetOperation(BaseModel):
    dataset_id: str
    feature_ids: Optional[list[str]]
    sample_ids: Optional[list[str]]

    # this field was added here by mistake. Making it optional so that we don't blow up if an old client sends it in
    destination: Optional[str] = None


class TabularSubsetOperation(BaseModel):
    dataset_id: str

    # this field was added here by mistake. Making it optional so that we don't blow up if an old client sends it in
    destination: Optional[str] = None


class FlatTableSubsetOperation(BaseModel):
    flat_table_id: str
    columns: list[str]


class ExportResult(BaseModel):
    url: str
