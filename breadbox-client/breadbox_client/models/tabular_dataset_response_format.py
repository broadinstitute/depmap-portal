from enum import Enum


class TabularDatasetResponseFormat(str, Enum):
    TABULAR_DATASET = "tabular_dataset"

    def __str__(self) -> str:
        return str(self.value)
