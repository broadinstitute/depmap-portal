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


@dataclass
class FeatureGroup:
    group_name: str
    depmap_ids: List[str]
    color_num: Union[str, int]


@dataclass
class PlotFeatures:
    linreg_by_group: List[LinRegInfo]
    depmap_ids: List[str]
    features: List[
        Feature
    ]  # featires explicitly asked for in list of features fed into endpoint as "features" parameter
    group_by: str
    groups: List[FeatureGroup]
    # Leaving this open to be a list of anything, but for right now (5/24/2022), the only supplemental details are a
    supplement_details: Optional[list] = None
