from typing import Protocol, List
import pandas as pd
from pandas.api.types import is_numeric_dtype
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq


class DataFrameWrapper(Protocol):
    def get_index_names(self) -> List[str]:
        ...

    def get_column_names(self) -> List[str]:
        ...

    def read_columns(self, columns: list[str]) -> pd.DataFrame:
        ...

    def is_sparse(self) -> bool:
        ...

    def get_df(self) -> pd.DataFrame:
        ...

    def is_numeric_cols(self) -> bool:
        ...


class ParquetDataFrameWrapper:
    def __init__(self, parquet_path: str):
        self.parquet_path = parquet_path
        self.schema = pq.read_schema(parquet_path)

    def get_index_names(self) -> List[str]:
        index_col = self.schema.names[0]
        index_names = pd.read_parquet(self.parquet_path, columns=[index_col])[
            index_col
        ].to_list()
        return index_names

    def get_column_names(self) -> List[str]:
        col_names = self.schema.names[1:]  # Exclude the index column
        return col_names

    def read_columns(self, columns: list[str]) -> pd.DataFrame:
        # NOTE: It appears that pd.read_parquet() by default uses pyarrow. However, for some reason
        #  when reading a file with 20k columns, the memory usage balloons
        # to > 30GB and would take down breadbox. However, using fastparquet seems to avoid this problem.
        return pd.read_parquet(self.parquet_path, columns=columns)

    def is_sparse(self) -> bool:
        # For now, we bypass checking sparsity for Parquet files to reduce complexity.
        return False

    def get_df(self) -> pd.DataFrame:
        if len(self.get_column_names()) > 10000:
            raise Exception(
                "Parquet file has too many columns to read into memory at once."
            )
        return pd.read_parquet(self.parquet_path)

    def is_numeric_cols(self) -> bool:
        for i, field in enumerate(self.schema):
            arrow_type = field.type

            if i == 0:  # Skip the index column
                continue

            if not (
                pa.types.is_integer(arrow_type) or pa.types.is_floating(arrow_type)
            ):
                return False

        return True


class PandasDataFrameWrapper:
    def __init__(self, df: pd.DataFrame):
        self.df = df
        # Get the row,col positions where df values are not null
        rows_idx, cols_idx = np.where(df.notnull())
        self.nonnull_indices = list(zip(rows_idx, cols_idx))

    def get_index_names(self) -> List[str]:
        return self.df.index.to_list()

    def get_column_names(self) -> List[str]:
        return self.df.columns.to_list()

    def read_columns(self, columns: list[str]) -> pd.DataFrame:
        return self.df.loc[:, columns]

    def is_sparse(self) -> bool:
        total_nulls = self.df.size - len(self.nonnull_indices)
        # Determine whether matrix is considered sparse (~2/3 elements are null). Use chunked storage for sparse matrices for more optimal storage
        is_sparse = total_nulls / self.df.size > 0.6
        return is_sparse

    def get_df(self) -> pd.DataFrame:
        return self.df

    def is_numeric_cols(self) -> bool:
        df = self.get_df()
        return all([is_numeric_dtype(df[col].dtypes) for col in df.columns])
