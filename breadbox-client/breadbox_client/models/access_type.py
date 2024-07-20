from enum import Enum


class AccessType(str, Enum):
    OWNER = "owner"
    READ = "read"
    WRITE = "write"

    def __str__(self) -> str:
        return str(self.value)
