import os
import re
import sqlite3
import uuid
from typing import List, Optional

import pandas as pd
import pyarrow.parquet as pq
import pyarrow.types as pa_types

from breadbox.config import Settings
from breadbox.crud import flat_table as flat_table_crud
from breadbox.db.session import SessionWithUser
from breadbox.models.flat_table import FlatTable
from breadbox.schemas.custom_http_exception import FileValidationError, UserError
from breadbox.schemas.flat_table import (
    ColumnType,
    FlatTableColumnMetadata,
    FlatTableCreateParams,
    FlatTableFilter,
    FlatTableSubsetColumn,
    FlatTableSubsetRequest,
    FlatTableSubsetResponse,
    FlatTableSummaryResponse,
    FlatTableResponse,
    GIVEN_ID_PATTERN,
)
from breadbox.service.upload import construct_file_from_ids
from itsdangerous.url_safe import URLSafeSerializer

_DATA_TABLE_NAME = "data"

_SQLITE_TYPE_BY_COLUMN_TYPE = {
    ColumnType.string: "TEXT",
    ColumnType.int: "INTEGER",
    ColumnType.float: "REAL",
}

# Used to coerce values read back from pyarrow/pandas (e.g. numpy.int64, numpy.float64)
# into the native Python types sqlite3 knows how to bind (None/int/float/str/bytes).
_PY_CAST_BY_COLUMN_TYPE = {
    ColumnType.string: str,
    ColumnType.int: int,
    ColumnType.float: float,
}

# Row batch size used when streaming the uploaded parquet file into SQLite, so that ingesting
# a ~100M row table doesn't require holding the whole dataframe in memory at once.
_INGEST_BATCH_SIZE = 100_000

_GIVEN_ID_RE = re.compile(GIVEN_ID_PATTERN)


def _quote_identifier(name: str) -> str:
    # column given_ids are already validated (by the pydantic schema) to only contain
    # [A-Za-z0-9_.-], which can't be used to break out of a double-quoted identifier. This
    # assertion is defense-in-depth in case that invariant is ever violated upstream.
    assert _GIVEN_ID_RE.match(name), f"Unsafe identifier: {name!r}"
    return f'"{name}"'


def _is_string_like(arrow_type) -> bool:
    return pa_types.is_string(arrow_type) or pa_types.is_large_string(arrow_type)


def _is_type_compatible(column_type: ColumnType, arrow_type) -> bool:
    if column_type == ColumnType.string:
        return _is_string_like(arrow_type)
    if column_type == ColumnType.int:
        return pa_types.is_integer(arrow_type)
    if column_type == ColumnType.float:
        return pa_types.is_floating(arrow_type) or pa_types.is_integer(arrow_type)
    return False


def _validate_schema_against_parquet(
    columns: List[FlatTableColumnMetadata], parquet_schema
) -> None:
    parquet_column_names = set(parquet_schema.names)
    declared_column_names = {c.given_id for c in columns}

    missing = declared_column_names - parquet_column_names
    if missing:
        raise FileValidationError(
            f"Declared column(s) {sorted(missing)} are not present in the uploaded file"
        )

    extra = parquet_column_names - declared_column_names
    if extra:
        raise FileValidationError(
            f"Uploaded file has column(s) {sorted(extra)} that were not declared in `columns`"
        )

    for column in columns:
        arrow_type = parquet_schema.field(column.given_id).type
        if not _is_type_compatible(column.type, arrow_type):
            raise FileValidationError(
                f"Column {column.given_id!r} was declared as type {column.type.value!r} "
                f"but the uploaded file has incompatible type {arrow_type!r}"
            )


def _ingest_parquet_to_sqlite(
    source_path: str,
    dest_path: str,
    columns: List[FlatTableColumnMetadata],
    indices: List[List[str]],
) -> int:
    "Stream the parquet file's rows into a new SQLite file (table `data`), building any requested indices. Returns the row count."
    parquet_file = pq.ParquetFile(source_path)
    _validate_schema_against_parquet(columns, parquet_file.schema_arrow)

    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    if os.path.exists(dest_path):
        os.remove(dest_path)

    column_names = [c.given_id for c in columns]
    column_casts = [_PY_CAST_BY_COLUMN_TYPE[c.type] for c in columns]

    conn = sqlite3.connect(dest_path)
    try:
        cursor = conn.cursor()

        column_defs = ", ".join(
            f"{_quote_identifier(c.given_id)} {_SQLITE_TYPE_BY_COLUMN_TYPE[c.type]}"
            for c in columns
        )
        cursor.execute(f"CREATE TABLE {_DATA_TABLE_NAME} ({column_defs})")

        quoted_columns = ", ".join(_quote_identifier(c) for c in column_names)
        placeholders = ", ".join("?" for _ in column_names)
        insert_sql = (
            f"INSERT INTO {_DATA_TABLE_NAME} ({quoted_columns}) VALUES ({placeholders})"
        )

        row_count = 0
        for batch in parquet_file.iter_batches(
            batch_size=_INGEST_BATCH_SIZE, columns=column_names
        ):
            batch_df = batch.to_pandas()
            raw_rows = batch_df[column_names].itertuples(index=False, name=None)
            # `_validate_schema_against_parquet` above already confirmed each column's
            # declared type is compatible with the uploaded file's arrow type, but
            # to_pandas() hands back numpy scalar types (e.g. numpy.int64) that sqlite3
            # doesn't know how to bind -- coerce each value to the native Python type its
            # column declares, preserving nulls.
            rows = [
                tuple(
                    None if pd.isna(value) else cast(value)
                    for value, cast in zip(row, column_casts)
                )
                for row in raw_rows
            ]
            if rows:
                cursor.executemany(insert_sql, rows)
                row_count += len(rows)

        for i, index_columns in enumerate(indices):
            quoted = ", ".join(_quote_identifier(c) for c in index_columns)
            cursor.execute(
                f'CREATE INDEX {_quote_identifier(f"idx_{i}")} ON {_DATA_TABLE_NAME} ({quoted})'
            )

        conn.commit()
    except Exception:
        conn.close()
        if os.path.exists(dest_path):
            os.remove(dest_path)
        raise
    else:
        conn.close()

    return row_count


def create_flat_table_from_upload(
    db: SessionWithUser, settings: Settings, params: FlatTableCreateParams,
) -> FlatTable:
    serializer = URLSafeSerializer(settings.breadbox_secret)
    source_path = construct_file_from_ids(
        params.file_ids, params.file_md5, serializer, settings.compute_results_location,
    )

    flat_table_id = str(uuid.uuid4())
    relative_sqlite_path = os.path.join("flat_tables", f"{flat_table_id}.sqlite3")
    dest_path = os.path.join(settings.filestore_location, relative_sqlite_path)

    row_count = _ingest_parquet_to_sqlite(
        source_path, dest_path, params.columns, params.indices
    )

    return flat_table_crud.create_flat_table(
        db,
        id=flat_table_id,
        given_id=params.given_id,
        name=params.name,
        sqlite_db_path=relative_sqlite_path,
        row_count=row_count,
        columns=params.columns,
        indices=params.indices,
        taiga_id=params.taiga_id,
        metadata=params.metadata,
    )


def _to_column_metadata(column) -> FlatTableColumnMetadata:
    return FlatTableColumnMetadata(
        given_id=column.given_id,
        name=column.name,
        references=column.references,
        type=column.type,
    )


def to_flat_table_response(flat_table: FlatTable) -> FlatTableResponse:
    return FlatTableResponse(
        flat_table_id=flat_table.id,
        given_id=flat_table.given_id,
        name=flat_table.name,
        row_count=flat_table.row_count,
        taiga_id=flat_table.taiga_id,
        metadata=flat_table.flat_table_metadata,
        columns=[_to_column_metadata(c) for c in flat_table.columns],
        indices=flat_table.indices,
    )


def to_flat_table_summary(
    flat_table: FlatTable, include_columns: bool = False
) -> FlatTableSummaryResponse:
    return FlatTableSummaryResponse(
        flat_table_id=flat_table.id,
        given_id=flat_table.given_id,
        name=flat_table.name,
        row_count=flat_table.row_count,
        taiga_id=flat_table.taiga_id,
        metadata=flat_table.flat_table_metadata,
        indices=flat_table.indices,
        columns=[_to_column_metadata(c) for c in flat_table.columns]
        if include_columns
        else None,
    )


def _cast_filter_value(value: str, column_type: str):
    if column_type == ColumnType.int.value:
        return int(value)
    if column_type == ColumnType.float.value:
        return float(value)
    return value


def _query_flat_table_as_dataframe(
    settings: Settings,
    flat_table: FlatTable,
    columns: List[str],
    filters: Optional[List[FlatTableFilter]] = None,
) -> pd.DataFrame:
    """
    Run a SELECT for the given columns against a flat table's underlying SQLite file,
    with optional filter clauses (AND'd together, each an IN-list against a single
    column). Returns one row per matching row and one column per entry in `columns`, in
    that order, with values exactly as stored (no numeric/null coercion). If `columns` is
    empty, returns a DataFrame with the correct row count and no columns.
    """
    columns_by_given_id = {c.given_id: c for c in flat_table.columns}

    for column in columns:
        if column not in columns_by_given_id:
            raise UserError(f"Unknown column {column!r} for this flat table")

    for filter in filters or []:
        if filter.column not in columns_by_given_id:
            raise UserError(
                f"Unknown filter column {filter.column!r} for this flat table"
            )

    where_clauses = []
    query_params: list = []
    for filter in filters or []:
        column_type = columns_by_given_id[filter.column].type
        cast_values = [_cast_filter_value(v, column_type) for v in filter.values]
        placeholders = ", ".join("?" for _ in cast_values)
        where_clauses.append(f"{_quote_identifier(filter.column)} IN ({placeholders})")
        query_params.extend(cast_values)

    quoted_columns = (
        ", ".join(_quote_identifier(c) for c in columns) if columns else "NULL"
    )
    select_sql = f"SELECT {quoted_columns} FROM {_DATA_TABLE_NAME}"
    if where_clauses:
        select_sql += " WHERE " + " AND ".join(where_clauses)

    full_sqlite_path = os.path.join(
        settings.filestore_location, flat_table.sqlite_db_path
    )
    conn = sqlite3.connect(full_sqlite_path)
    try:
        cursor = conn.cursor()
        cursor.execute(select_sql, query_params)
        rows = cursor.fetchall()
    finally:
        conn.close()

    if not columns:
        return pd.DataFrame(index=range(len(rows)))

    return pd.DataFrame(rows, columns=pd.Index(columns), dtype=object)


def get_flat_table_dataframe(
    settings: Settings, flat_table: FlatTable, columns: List[str],
) -> pd.DataFrame:
    "Read the given columns of a flat table into a DataFrame, in row order."
    if not columns:
        raise UserError("Must specify at least one column to export")

    return _query_flat_table_as_dataframe(settings, flat_table, columns)


def get_flat_table_subset(
    settings: Settings, flat_table: FlatTable, request: FlatTableSubsetRequest,
) -> FlatTableSubsetResponse:
    columns_by_given_id = {c.given_id: c for c in flat_table.columns}

    requested_columns = (
        request.columns
        if request.columns is not None
        else list(columns_by_given_id.keys())
    )

    df = _query_flat_table_as_dataframe(
        settings, flat_table, requested_columns, request.filters
    )

    result_columns = [
        FlatTableSubsetColumn(
            metadata=_to_column_metadata(columns_by_given_id[column]),
            values=df[column].tolist(),
        )
        for column in requested_columns
    ]

    return FlatTableSubsetResponse(columns=result_columns, row_count=len(df))
