from enum import Enum


class AnnotationType(str, Enum):
    BINARY = "binary"
    CATEGORICAL = "categorical"
    CONTINUOUS = "continuous"
    LIST_STRINGS = "list_strings"
    TEXT = "text"

    def __str__(self) -> str:
        return str(self.value)
