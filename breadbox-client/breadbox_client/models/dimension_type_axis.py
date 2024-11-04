from enum import Enum


class DimensionTypeAxis(str, Enum):
    FEATURE = "feature"
    SAMPLE = "sample"

    def __str__(self) -> str:
        return str(self.value)
