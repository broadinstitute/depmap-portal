from enum import Enum


class MatrixDatasetParamsDataFileFormat(str, Enum):
    CSV = "csv"
    PARQUET = "parquet"

    def __str__(self) -> str:
        return str(self.value)
