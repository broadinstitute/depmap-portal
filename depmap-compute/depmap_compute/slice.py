from dataclasses import dataclass
from enum import Enum


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
