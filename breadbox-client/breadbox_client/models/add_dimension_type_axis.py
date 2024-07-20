from enum import Enum


class AddDimensionTypeAxis(str, Enum):
    FEATURE = "feature"
    SAMPLE = "sample"

    def __str__(self) -> str:
        return str(self.value)
