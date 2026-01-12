from pydantic import BaseModel
from breadbox.depmap_compute_embed.slice import SliceQuery
from typing import List, Optional, Union


class DatasetSummary(BaseModel):
    id: str
    name: str
    dimension_type: Optional[str] = None
    dataset_id: str
    dataset_given_id: Union[str, None]


class Association(BaseModel):
    correlation: float
    log10qvalue: float
    other_dataset_id: str
    other_dataset_given_id: Union[str, None]
    other_dimension_given_id: str
    other_dimension_label: str


class Associations(BaseModel):
    dataset_name: str
    dataset_given_id: Union[str, None]
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
    dataset_1_name: str
    dataset_2_name: str
    axis: Literal["sample", "feature"]
    dataset_1_id: str
    dataset_2_id: str
