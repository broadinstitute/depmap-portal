from dataclasses import dataclass
from enum import Enum
from typing import Optional


@dataclass
class MatrixDataset:
    """
    Contains all dataset attributes which are generalizable between
    the two backend implementations.
    """

    id: str
    given_id: Optional[str]
    label: str
    data_type: Optional[str]
    feature_type: Optional[str]
    sample_type: str
    priority: Optional[int]
    taiga_id: Optional[str]
    units: Optional[str]
    is_continuous: bool


# These type definitions will eventually be moved to the shared module
class SliceIdentifierType(Enum):
    feature_id = "feature_id"
    feature_label = "feature_label"
    sample_id = "sample_id"
    sample_label = "sample_label"
    column = "column"


@dataclass
class SliceQuery:
    dataset_id: str
    identifier: str
    indentifier_type: SliceIdentifierType
