from pydantic import BaseModel
from typing import List


class DatasetSummary(BaseModel):
    id: str
    name: str
    dimension_type: str
    dataset_id: str


class Association(BaseModel):
    correlation: float
    other_dataset_id: str
    other_dimension_given_id: str
    other_dimension_label: str


class Associations(BaseModel):
    dataset_name: str
    dimension_label: str
    associated_datasets: List[DatasetSummary]
    associated_dimensions: List[Association]


from typing import Literal


class AssociationsIn(BaseModel):
    dataset_1_id: str
    dataset_2_id: str
    axis: Literal["sample", "feature"]
    file_ids: List[str]
    md5: str


class AssociationTable(BaseModel):
    id: str
    dataset_1_id: str
    dataset_2_id: str