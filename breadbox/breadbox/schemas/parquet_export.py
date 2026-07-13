from pydantic import BaseModel
from typing import Optional


class MatrixSubsetOperation(BaseModel):
    dataset_id: str
    destination: str
    feature_ids: Optional[list[str]]
    sample_ids: Optional[list[str]]


class TabularSubsetOperation(BaseModel):
    dataset_id: str
    destination: str


class ExportResult(BaseModel):
    url: str
