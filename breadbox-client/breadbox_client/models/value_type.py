from enum import Enum


class ValueType(str, Enum):
    CATEGORICAL = "categorical"
    CONTINUOUS = "continuous"

    def __str__(self) -> str:
        return str(self.value)
