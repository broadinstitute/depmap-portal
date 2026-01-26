from http.client import HTTPException
from pyexpat import features
from typing import (
    Callable,
    Tuple,
    Any,
    Union,
    Iterator,
    Iterable,
    List,
    Type,
    Sequence,
    Dict,
)

from breadbox.db.session import SessionWithUser
from ...schemas.custom_http_exception import UserError
from ...schemas.dataset import (
    AnnotationType,
    MatrixDimensionsInfo,
    FeatureSampleIdentifier,
)
from ...crud import dataset as crud_dataset
from ...crud import dimension_types as crud_dimension_types
from ...crud import dimension_ids as crud_dimension_ids
from ...models.dataset import (
    MatrixDataset,
    TabularDataset,
    DatasetFeature,
    DatasetSample,
)
import re
import bisect

import apsw
import apsw.ext
from .schema import assign_names, SchemaNames
from breadbox.utils.profiling import profiled_region

import sqlglot
import sqlglot.errors
import sqlglot.expressions
import csv
import io

SQLiteValue = Any
import logging

log = logging.getLogger(__name__)


def _create_schema_str(columns: Iterable[str]) -> str:
    column_defs = ""
    for i, c in enumerate(columns):
        if column_defs:
            column_defs += ", "
        column_defs += f"[{c}]"

    schema = f"CREATE TABLE ignored({column_defs})"
    return schema


class Module:
    def __init__(
        self,
        callable: Callable,
        get_columns: Callable,
        parameters: tuple[str],
        repr_invalid: bool,
    ):
        self.get_columns = get_columns
        self.callable: Callable = callable
        self.repr_invalid = repr_invalid
        self.parameters = parameters

    def Create(self, db, modulename, dbname, tablename, *args):
        if len(args) > len(self.parameters):
            raise ValueError(
                f"Too many parameters: parameters accepted are {' '.join(self.parameters)}"
            )

        def to_python(arg):
            "Consume sqlite values and parse them as python values"
            m = re.match("^'([^']*)'$", arg)
            assert m
            return m.group(1)

        param_values = dict(zip(self.parameters, [to_python(arg) for arg in args]))
        columns = list(self.get_columns(**param_values))
        schema = _create_schema_str(columns)
        return schema, Table(self.callable, columns, param_values)  # type: ignore[return-value]

    Connect = Create


class Table:
    def __init__(
        self, callable: Callable, columns: List[str], param_values: dict[str, Any]
    ):
        self.callable = callable
        self.columns = columns
        self.param_values = param_values

    def BestIndex(
        self,
        constraints: Sequence[tuple[int, int]],
        orderbys: Sequence[tuple[int, int]],
    ):
        #        print(f"BestIndex {self.param_values} {constraints}")
        idx_str: list[str] = []
        constraints_used = []
        for constrained_col_index, constrained_op in constraints:
            constrained_column = self.columns[constrained_col_index]

            if constrained_op != apsw.SQLITE_INDEX_CONSTRAINT_EQ:
                #                print(f"Cannot use {constrained_op} constraint on {constrained_column}. Skipping")
                constraints_used.append(None)
                continue

            #            print(f"{constrained_column} is constrained by ==")

            assert constrained_column not in idx_str
            constraints_used.append(len(idx_str))
            idx_str.append(constrained_column)

        #        print(f"list of constrained columns: {constraints_used} {idx_str}")

        if len(idx_str) == 0:
            # no filters is more expensive than any filter
            cost = 1000000
        else:
            cost = 100

        result = (tuple(constraints_used), 0, ",".join(idx_str), False, cost)
        #        print(f"BestIndex returning {result}")
        return result

    #        return [constraints_used, 0, ",".join(idx_str), False, cost]

    def Open(self):
        return Cursor(self.callable, self.param_values)

    def Disconnect(self) -> None:
        pass

    Destroy = Disconnect


class Cursor:
    def __init__(self, callable: Callable, param_values: dict[str, SQLiteValue]):
        self.param_values = param_values
        self.iterating: Union[Iterator[SQLiteValue], None] = None
        self.current_row: Any = None
        self.callable = callable
        print(f"Cursor.__init__: {(self.param_values)}")

    def Filter(self, idx_num: int, idx_str: str, args: tuple[SQLiteValue]) -> None:
        #        print(f"Filter({idx_str}, {args}) (func params={self.param_values})")
        params: dict[str, SQLiteValue] = self.param_values.copy()
        if idx_str is not None:
            params.update(zip(idx_str.split(","), args))
        self.iterating = iter(self.callable(**params))
        # proactively advance so we can tell if eof
        self.Next()

    def Eof(self) -> bool:
        return self.iterating is None

    def Close(self) -> None:
        if self.iterating:
            if hasattr(self.iterating, "close"):
                # fmt: off
                # pyright isn't smart enough to see we just checked for the attribute
                self.iterating.close() # pyright: ignore
                # fmt: on
            self.iterating = None

    def Column(self, which: int) -> SQLiteValue:
        v = self.current_row[which]
        return v  # type: ignore[no-any-return]

    def Next(self) -> None:
        try:
            self.current_row = next(self.iterating)  # type: ignore[arg-type]
        except StopIteration:
            if hasattr(self.iterating, "close"):
                self.iterating.close()  # type: ignore[union-attr]
            self.iterating = None

    def Rowid(self):
        return id(self.current_row)


def make_virtual_module(
    db: apsw.Connection,
    name: str,
    callable: Callable,
    get_columns: Callable,
    parameters: Tuple[str],
    *,
    eponymous: bool = True,
    eponymous_only: bool = False,
    repr_invalid: bool = False,
) -> None:
    """
    Registers a read-only virtual table module with *db* based on
    *callable*.  Heavily based on `apsw.ext.make_virtual_module()`

    If sqlite wants to filter table with an equality clause, function will
    be called passing in the constraints as parameters
    """

    mod = Module(callable, get_columns, parameters, repr_invalid,)

    # unregister any existing first
    db.create_module(name, None)
    db.create_module(
        name,
        mod,  # type: ignore[arg-type]
        eponymous=eponymous,
        eponymous_only=eponymous_only,
        read_only=True,
    )


def add_matrix_dataset(connection, dataset: MatrixDataset, schema: SchemaNames):
    table_name = schema.get_dataset_table_name(dataset.id)
    connection.execute(
        f"CREATE VIRTUAL TABLE \"{table_name}\" using query_matrix_dataset('{dataset.id}')"
    )
    connection.execute(
        f"CREATE VIRTUAL TABLE \"{table_name}_sample\" using query_matrix_dataset_samples('{dataset.id}')"
    )
    connection.execute(
        f"CREATE VIRTUAL TABLE \"{table_name}_feature\" using query_matrix_dataset_features('{dataset.id}')"
    )


def add_tabular_dataset(connection, dataset: TabularDataset, schema: SchemaNames):
    table_name = schema.get_dataset_table_name(dataset.id)
    connection.execute(
        f"CREATE VIRTUAL TABLE \"{table_name}\" using query_tabular_dataset('{dataset.id}')"
    )


from .. import dataset as dataset_service


def query_matrix_dataset(db, filestore_location, dataset_id, **constraints):
    matrix_dataset = crud_dataset.get_dataset(db, db.user, dataset_id)
    assert isinstance(matrix_dataset, MatrixDataset)

    if "feature_id" in constraints:
        # fetch values by feature
        matrix_dimensions_info = MatrixDimensionsInfo(
            feature_identifier=FeatureSampleIdentifier.id,
            sample_identifier=FeatureSampleIdentifier.id,
            features=[constraints["feature_id"]],
        )
    elif "sample_id" in constraints:
        # fetch values by sample
        matrix_dimensions_info = MatrixDimensionsInfo(
            feature_identifier=FeatureSampleIdentifier.id,
            sample_identifier=FeatureSampleIdentifier.id,
            samples=[constraints["sample_id"]],
        )
    else:
        # return everything
        matrix_dimensions_info = MatrixDimensionsInfo(
            feature_identifier=FeatureSampleIdentifier.id,
            sample_identifier=FeatureSampleIdentifier.id,
        )

    df = dataset_service.get_subsetted_matrix_dataset_df(
        db, matrix_dataset, matrix_dimensions_info, filestore_location,
    )

    for sample_id in df.index:
        for feature_id in df.columns:
            value = df.loc[sample_id, feature_id]
            yield (sample_id, feature_id, value)


def _query_matrix_dataset_dimension(
    db,
    matrix_dataset: MatrixDataset,
    dimension_subtype_cls: Union[Type[DatasetFeature], Type[DatasetSample]],
):
    metadata_col_name = "label"
    if dimension_subtype_cls is DatasetFeature:
        dimension_type = matrix_dataset.feature_type
    else:
        assert dimension_subtype_cls is DatasetSample
        dimension_type = matrix_dataset.sample_type

    if dimension_type is None:
        # special case: Arises when feature type is None. Return the list of given_ids
        assert dimension_subtype_cls is DatasetFeature
        return sorted(
            [
                x.given_id
                for x in crud_dimension_ids.get_matrix_dataset_features(
                    db, matrix_dataset
                )
            ]
        )
    else:
        id_and_labels = crud_dataset.get_metadata_used_in_matrix_dataset(
            db,
            dimension_type,
            matrix_dataset,
            dimension_subtype_cls,
            metadata_col_name,
        )

        return sorted(id_and_labels.keys())


def query_matrix_dataset_samples(db, index_cache, dataset_id, **constraints):
    return _query_matrix_dataset_samples(
        db, index_cache, dataset_id, "sample_id", **constraints
    )


def query_matrix_dataset_features(db, index_cache, dataset_id, **constraints):
    return _query_matrix_dataset_samples(
        db, index_cache, dataset_id, "feature_id", **constraints
    )


def sorted_list_contains(haystack, needle):
    i = bisect.bisect_left(haystack, needle)
    return i < len(haystack) and haystack[i] == needle


def _query_matrix_dataset_samples(
    db, index_cache, dataset_id, dim_id_type, **constraints
):
    print(f"Querying {dim_id_type} dimensions with constraints ({constraints})")
    dataset_key = f"dataset:{dataset_id}"
    if dataset_key not in index_cache:
        matrix_dataset = crud_dataset.get_dataset(db, db.user, dataset_id)
        index_cache[dataset_key] = matrix_dataset
    else:
        matrix_dataset = index_cache[dataset_key]

    assert isinstance(matrix_dataset, MatrixDataset)

    samples_key = f"{dim_id_type}:{dataset_id}"
    if samples_key not in index_cache:
        dim_ids = _query_matrix_dataset_dimension(
            db,
            matrix_dataset,
            {"sample_id": DatasetSample, "feature_id": DatasetFeature}[dim_id_type],
        )
        index_cache[samples_key] = dim_ids
    else:
        dim_ids = index_cache[samples_key]

    if len(constraints) > 0:
        # if there's any constraint, we can assume it's on dim_id_type
        dim_id = constraints[dim_id_type]
        print(f"Searching for {dim_id} among {dim_ids}")
        if sorted_list_contains(dim_ids, dim_id):
            print("found")
            yield (dim_id,)
        else:
            print("not found")
    else:
        print("found ids", dim_ids)
        for dim_id in dim_ids:
            yield (dim_id,)


import pandas as pd


def _fix_continuous_column_types(
    df: pd.DataFrame, dataset: TabularDataset
) -> pd.DataFrame:
    df = df.copy()
    for col_name, column_metadata in dataset.columns_metadata.items():
        if column_metadata.col_type == AnnotationType.continuous:
            df[col_name] = df[col_name].astype(float)
    return df


def _build_indexed_version_of_tabular_data(
    db: SessionWithUser,
    dataset: TabularDataset,
    constraint_columns,
    constraints: Dict[str, Any],
):
    # build indexed version of table
    # print(f"e {time.time() - start:.2f} seconds")
    # start = time.time()
    df = crud_dataset.get_subset_of_tabular_data_as_df(db, dataset, None, None)
    df = _fix_continuous_column_types(df, dataset)

    extra_columns = set(constraints.keys()).difference(df.columns)
    assert (
        len(extra_columns) == 0
    ), f"Constraints provided for {extra_columns} but the columns were {df.columns}"

    # print(f"f {time.time() - start:.2f} seconds")
    # start = time.time()
    by_key = {}
    for rec in df.to_records():
        key = tuple(
            [rec[constraint_column] for constraint_column in constraint_columns]
        )
        if key not in by_key:
            by_key[key] = [rec]
        else:
            by_key[key].append(rec)

    return by_key


def query_tabular_dataset(db, index_cache, columns, dataset_id, **constraints):
    # print("dataset_id", dataset_id, constraints)
    # start = time.time()
    # not efficient, but first goal is something that works:

    try:
        dataset_key = f"dataset:{dataset_id}"
        if dataset_key not in index_cache:
            dataset = crud_dataset.get_dataset(db, db.user, dataset_id)
            assert isinstance(dataset, TabularDataset)
            index_cache[dataset_key] = dataset
        else:
            dataset = index_cache[dataset_key]

        if len(constraints) > 0:
            # construct an index to avoid slow lookups. If we need to look up via a particular key,
            # we'll probably need to use that combo again (if it's due to a join), so cache the table indexed that way.
            constraint_columns = sorted(constraints.keys())
            index_key = tuple(["idx", dataset_id] + constraint_columns)
            if index_key not in index_cache:
                index_cache[index_key] = _build_indexed_version_of_tabular_data(
                    db, dataset, constraint_columns, constraints
                )

            # extract out the records with this key
            records_key = tuple(
                [
                    constraints[constraint_column]
                    for constraint_column in constraint_columns
                ]
            )

            recs = index_cache[index_key].get(records_key, [],)
        else:
            # if we weren't given a constraint, just fetch the whole table and return all the rows
            df = crud_dataset.get_subset_of_tabular_data_as_df(db, dataset, None, None)
            df2 = _fix_continuous_column_types(df, dataset)
            recs = df2.to_records()

        # return the rows that were fetched
        for row in recs:
            yield [row[column] for column in columns]

    except Exception as e:
        log.exception("Got exception in query_tabular_dataset")
        raise


def create_db_with_virtual_schema(db: SessionWithUser, filestore_location: str):
    datasets = crud_dataset.get_datasets(db, db.user)
    dim_types = crud_dimension_types.get_dimension_types(db)

    columns_by_dataset_id = {}
    for dataset in datasets:
        if isinstance(dataset, TabularDataset):
            column_names = []
            for column_name, column_metadata in sorted(
                dataset.columns_metadata.items()
            ):
                column_names.append(column_name)
            columns_by_dataset_id[dataset.id] = column_names

    schema = assign_names(datasets, dim_types)

    connection = apsw.Connection(":memory:")

    index_cache = {}

    make_virtual_module(
        connection,
        "query_matrix_dataset",
        lambda **args: query_matrix_dataset(db, filestore_location, **args),
        lambda **args: ("sample_id", "feature_id", "value"),
        ("dataset_id",),
    )

    make_virtual_module(
        connection,
        "query_matrix_dataset_samples",
        lambda **args: query_matrix_dataset_samples(db, index_cache, **args),
        lambda **args: ("sample_id",),
        ("dataset_id",),
    )

    make_virtual_module(
        connection,
        "query_matrix_dataset_features",
        lambda **args: query_matrix_dataset_features(db, index_cache, **args),
        lambda **args: ("feature_id",),
        ("dataset_id",),
    )

    make_virtual_module(
        connection,
        "query_tabular_dataset",
        lambda dataset_id, **constraints: query_tabular_dataset(
            db,
            index_cache,
            columns_by_dataset_id[dataset_id],
            dataset_id,
            **constraints,
        ),
        lambda dataset_id: columns_by_dataset_id[dataset_id],
        ("dataset_id",),
    )

    for dataset in datasets:
        if isinstance(dataset, MatrixDataset):
            add_matrix_dataset(connection, dataset, schema)
        elif isinstance(dataset, TabularDataset):
            add_tabular_dataset(connection, dataset, schema)
        else:
            raise NotImplementedError(f"unknown: {dataset}")

    return connection


def assert_single_select(sql: str):
    try:
        parsed = sqlglot.parse(sql, dialect="sqlite")
    except sqlglot.errors.SqlglotError as ex:
        raise UserError(f"Could not parse query: {ex}")

    if len(parsed) != 1:
        raise UserError(f"Expected a single statement but got {len(parsed)}")

    if not isinstance(parsed[0], sqlglot.expressions.Select):
        raise UserError(f"Only SELECT statements are allowed")


def create_to_row_func():
    buffer = io.StringIO()
    csv_writer = csv.writer(buffer)

    def to_row(row: list[str]):
        nonlocal csv_writer
        # truncate buffer
        buffer.seek(0)
        buffer.truncate()
        # write a single row to it
        csv_writer.writerow(row)
        return buffer.getvalue()

    return to_row


def stream_cursor_as_csv(column_names, cursor, cleanup_callback):
    try:
        with profiled_region("stream_cursor_as_csv"):
            to_row = create_to_row_func()
            # write out column names as first row
            yield to_row(column_names)

            # write out all rows
            for row in cursor:
                yield to_row(row)
    finally:
        cleanup_callback()


def execute_sql_in_virtual_db(
    db: SessionWithUser, filestore_location: str, sql_statement: str
):
    with profiled_region("execute_sql_in_virtual_db"):
        assert_single_select(sql_statement)

        with profiled_region("create_db_with_virtual_schema"):
            virtual_db_connection = create_db_with_virtual_schema(
                db, filestore_location
            )
            cursor = virtual_db_connection.cursor()

        with profiled_region(f"execute statement"):
            try:
                cursor.execute(sql_statement)
            except apsw.SQLError as ex:
                raise UserError(str(ex))

        # get the column names by using query_info. Alternatively we could probably get column names
        # by using the strategy at https://github.com/rogerbinns/apsw/blob/7a9a4b695a2ef038514d2dc4e0b95e44111132ac/apsw/ext.py#L1859
        # The naive approach of running the query and using cursor.description after the fact throws an exception
        # `apsw.ExecutionCompleteError: Can't get description for statements that have completed execution` if the query results
        # in no rows.
        query_info = apsw.ext.query_info(virtual_db_connection, sql_statement)
        col_names = [col_name for col_name, _ in query_info.description]
        log.warning(f"got cursor names: {col_names}")

        def cleanup_callback():
            # this might all automatically get cleaned up by the GC, but let's clean it up like we're supposed to
            # just in case
            cursor.close()
            virtual_db_connection.close()

    return stream_cursor_as_csv(col_names, cursor, cleanup_callback)
