from enum import Enum


class MatrixDatasetParamsFormat(str, Enum):
    MATRIX = "matrix"

    def __str__(self) -> str:
        return str(self.value)
