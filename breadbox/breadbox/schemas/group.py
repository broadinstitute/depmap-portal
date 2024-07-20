from pydantic import BaseModel

import enum
from .common import DBBase


class AccessType(enum.Enum):
    read = "read"
    write = "write"
    owner = "owner"


class GroupEntryBase(BaseModel):
    email: str
    exact_match: bool = True
    access_type: AccessType


class GroupEntryIn(GroupEntryBase):
    pass


class GroupEntry(GroupEntryBase, DBBase):
    pass


class GroupBase(BaseModel):
    name: str


class GroupIn(GroupBase):
    pass


class Group(GroupBase, DBBase):
    pass
