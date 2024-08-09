from enum import Enum


class TabularDatasetUpdateParamsFormat(str, Enum):
    TABULAR = "tabular"

    def __str__(self) -> str:
        return str(self.value)
