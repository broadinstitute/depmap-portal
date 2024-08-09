from enum import Enum


class MatrixDatasetUpdateParamsFormat(str, Enum):
    MATRIX = "matrix"

    def __str__(self) -> str:
        return str(self.value)
