from enum import Enum


class TableDatasetParamsFormat(str, Enum):
    TABULAR = "tabular"

    def __str__(self) -> str:
        return str(self.value)
