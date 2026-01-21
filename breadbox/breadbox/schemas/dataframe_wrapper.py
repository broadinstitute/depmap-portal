from typing import Protocol, List, Optional, Any

import h5py
import pandas as pd
from pandas.api.types import is_numeric_dtype, is_string_dtype
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import pyarrow
from pandas.core.dtypes.common import is_bool_dtype

from breadbox.schemas.custom_http_exception import FileValidationError

# fetching more than this number of columns at one time will result in an exception being thrown
MAX_COLUMNS_FETCHED = 30000


class DataFrameWrapper(Protocol):
    """Used to encapsulate a dataframe without necessarily reading the entire thing into memory"""

    def get_index_names(self) -> List[str]:
        ...

    def get_column_names(self) -> List[str]:
        ...

    def read_columns(self, columns: list[str]) -> pd.DataFrame:
        ...

    def get_df(self) -> pd.DataFrame:
        ...

    def is_numeric_cols(self) -> bool:
        ...

    def is_string_cols(self) -> bool:
        ...


class HDF5DataFrameWrapper(DataFrameWrapper):
    def __init__(self, filename: str):
        self.filename = filename
        self.file: Any = h5py.File(
            filename, "r"
        )  # the type hints on h5py appear to not understand that a Dataset is indexable, so disable typing for this field
        # cached mapping from name to index
        self.dim_0 = None
        self.dim_1 = None
        self.dim_0_to_index = None
        self.dim_1_to_index = None

    def close(self):
        self.file.close()

    def get_index_names(self) -> List[str]:
        if self.dim_0 is None:
            self.dim_0 = [x.decode("utf8") for x in self.file["dim_0"]]
        return self.dim_0

    def get_column_names(self) -> List[str]:
        if self.dim_1 is None:
            self.dim_1 = [x.decode("utf8") for x in self.file["dim_1"]]
        return self.dim_1

    def _get_column_names_to_index(self):
        if self.dim_1_to_index is None:
            mapping = {
                name: index for index, name in enumerate(self.get_column_names())
            }
            self.dim_1_to_index = mapping
        return self.dim_1_to_index

    def read_columns(self, columns: list[str]) -> pd.DataFrame:
        # columns can be from [index] + dim_1, so we need to special case handling of "index"

        mapping = self._get_column_names_to_index()
        column_src_index_with_dest_index = [
            (
                # source index
                mapping[name],
                # dest index
                dest_index,
                # column name
                name,
            )
            for dest_index, name in enumerate(columns)
        ]

        # read the columns from the hdf5 file
        matrix = self.file["data"][
            :, [src_index for src_index, _, _ in column_src_index_with_dest_index]
        ]

        # now copy them into a map that we'll use to construct the dataframe
        df_columns = {}
        for _, matrix_index, column_name in column_src_index_with_dest_index:
            df_columns[column_name] = matrix[:, matrix_index]

        # typechecked does not like columns and index due to bug in pandas https://github.com/pandas-dev/pandas/issues/56995
        return pd.DataFrame(
            df_columns, columns=columns, index=self.get_index_names()  # pyright: ignore
        )

    def get_df(self) -> pd.DataFrame:
        if len(self.get_column_names()) > MAX_COLUMNS_FETCHED:
            raise Exception(
                "HDF5 file has too many columns to read into memory at once."
            )
        return self.read_columns(self.get_column_names())

    def is_numeric_cols(self) -> bool:
        # assuming all hdf5 files are numeric
        return True

    def is_string_cols(self) -> bool:
        return False


class ParquetDataFrameWrapper(DataFrameWrapper):
    def __init__(self, parquet_path: str):
        self.parquet_path = parquet_path
        self.file = pq.ParquetFile(parquet_path)
        self.schema = self.file.schema_arrow

        # the first column will be treated as the index. Make sure it's of type string
        index_col = self.schema.names[0]
        if not pyarrow.types.is_string(self.schema.field(index_col).type):
            raise FileValidationError(
                f"Make sure the first column in the parquet file is the index and is of type string."
            )

        self.col_type = self._determine_col_type()

    def _determine_col_type(self):
        """Will either return 'float', 'str' or 'mixed'"""

        float_columns = 0
        str_columns = 0
        other_columns = 0

        for i, field in enumerate(self.schema):
            arrow_type = field.type

            if i == 0:  # Skip the index column
                continue

            if pa.types.is_integer(arrow_type) or pa.types.is_floating(arrow_type):
                float_columns += 1
            elif pyarrow.types.is_string(arrow_type):
                str_columns += 1
            else:
                other_columns += 1

        if float_columns == 0 and other_columns == 0 and str_columns > 0:
            return "str"

        if str_columns == 0 and other_columns == 0 and float_columns > 0:
            return "float"

        return "mixed"

    def get_index_names(self) -> List[str]:
        index_col = self.schema.names[0]
        index_names = self.file.read(columns=[index_col]).column(index_col).to_pylist()
        return index_names

    def get_column_names(self) -> List[str]:
        col_names = self.schema.names[1:]  # Exclude the index column
        return col_names

    def read_columns(self, columns: list[str]) -> pd.DataFrame:
        return self.file.read(columns=columns).to_pandas()

    def get_df(self) -> pd.DataFrame:
        if len(self.get_column_names()) > MAX_COLUMNS_FETCHED:
            raise Exception(
                f"Parquet file has {len(self.get_column_names())} columns, but we only allow {MAX_COLUMNS_FETCHED} to be read into memory at once."
            )
        df = self.file.read().to_pandas()
        df.index = df[df.columns[0]]
        df.drop(columns=[df.columns[0]], inplace=True)
        return df

    def is_string_cols(self) -> bool:
        return self.col_type == "str"

    def is_numeric_cols(self) -> bool:
        return self.col_type == "float"


class PandasDataFrameWrapper:
    def __init__(self, df: pd.DataFrame):
        self.df = df
        self.nonnull_indices = None
        self.col_type = self._determine_col_type()

    def _determine_col_type(self):
        float_columns = 0
        str_columns = 0
        other_columns = 0

        for col in self.df.columns:
            col_dtype = self.df[col].dtypes
            if is_numeric_dtype(col_dtype) or is_bool_dtype(col_dtype):
                float_columns += 1
            elif is_string_dtype(col_dtype):
                str_columns += 1
            else:
                other_columns += 1

        if float_columns == 0 and other_columns == 0 and str_columns > 0:
            return "str"

        if str_columns == 0 and other_columns == 0 and float_columns > 0:
            return "float"

        return "mixed"

    def get_index_names(self) -> List[str]:
        return self.df.index.to_list()

    def get_column_names(self) -> List[str]:
        return self.df.columns.to_list()

    def read_columns(self, columns: list[str]) -> pd.DataFrame:
        return self.df.loc[:, columns]

    def get_nonnull_indices(self):
        if self.nonnull_indices is None:
            # Get the row,col positions where df values are not null
            rows_idx, cols_idx = np.where(self.df.notnull())
            self.nonnull_indices = list(zip(rows_idx, cols_idx))
        return self.nonnull_indices

    def get_df(self) -> pd.DataFrame:
        return self.df

    def is_string_cols(self) -> bool:
        return self.col_type == "str"

    def is_numeric_cols(self) -> bool:
        return self.col_type == "float"


def column_batch_iterator(dfw: DataFrameWrapper, batch_size: int):
    cols = dfw.get_column_names()
    for start_column_index in range(0, len(cols), batch_size):
        # Find the correct column slice to write
        end_column_index = min(start_column_index + batch_size, len(cols))

        col_batch = cols[start_column_index:end_column_index]

        # Read the chunk of data from the Parquet file
        chunk_df = dfw.read_columns(col_batch)
        yield start_column_index, end_column_index, chunk_df
