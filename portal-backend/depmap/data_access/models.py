from dataclasses import dataclass
from typing import Optional


@dataclass
class MatrixDataset:
    """
    Contains all dataset attributes which are generalizable between
    the two backend implementations.
    """

    id: str
    label: str
    data_type: Optional[str]
    feature_type: Optional[str]
    sample_type: str
    priority: Optional[int]
    taiga_id: Optional[str]
    units: Optional[str]
    is_continuous: bool
