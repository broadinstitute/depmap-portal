from pydantic import Field
from typing import List, Optional
from uuid import UUID

from .group import GroupBase, DBBase, GroupEntry
from .dataset import DatasetResponse


class GroupOut(GroupBase, DBBase):
    id: UUID
    group_entries: List[GroupEntry]
    datasets: Optional[List[DatasetResponse]] = None
