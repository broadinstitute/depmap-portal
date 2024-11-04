from enum import Enum


class FeatureSampleIdentifier(str, Enum):
    ID = "id"
    LABEL = "label"

    def __str__(self) -> str:
        return str(self.value)
