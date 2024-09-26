from dataclasses import dataclass
from enum import Enum
from typing import Literal


@dataclass
class SliceQuery:
    dataset_id: str
    identifier: str
    identifier_type: Literal[
        "feature_id", "feature_label", "sample_id", "sample_label", "column"
    ]
