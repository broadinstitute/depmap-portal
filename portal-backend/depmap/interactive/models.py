from dataclasses import dataclass
from typing import Any, List, Optional, Union


@dataclass
class Feature:
    feature_id: str  # slice id
    values: List[Any]  # int list or string list
    label: str  # 'SOX10'
    axis_label: str


@dataclass
class LinRegInfo:
    slope: float
    intercept: float
    number_of_points: int
    pearson: float
    spearman: float
    p_value: float
    group_label: str
