from dataclasses import dataclass
from typing import Any, List, Optional, Union


@dataclass
class Feature:
    feature_id: str  # slice id
    values: List[Any]  # int list or string list
    label: str  # 'SOX10'
    axis_label: str
