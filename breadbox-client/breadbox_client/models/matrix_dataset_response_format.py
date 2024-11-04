from enum import Enum


class MatrixDatasetResponseFormat(str, Enum):
    MATRIX_DATASET = "matrix_dataset"

    def __str__(self) -> str:
        return str(self.value)
