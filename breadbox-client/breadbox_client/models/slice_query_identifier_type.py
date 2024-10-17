from enum import Enum


class SliceQueryIdentifierType(str, Enum):
    COLUMN = "column"
    FEATURE_ID = "feature_id"
    FEATURE_LABEL = "feature_label"
    SAMPLE_ID = "sample_id"
    SAMPLE_LABEL = "sample_label"

    def __str__(self) -> str:
        return str(self.value)
