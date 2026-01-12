from typing import Callable, Tuple, Any, Union, Iterator, Iterable, List, Type

from apsw.ext import get_column_names

from breadbox.db.session import SessionWithUser
from ...schemas.dataset import AnnotationType
from ...crud import dataset as crud_dataset
from ...crud import dimension_types as crud_dimension_types
from ...models.dataset import (
    MatrixDataset,
    TabularDataset,
    Dataset,
    DimensionType,
    DatasetFeature,
    DatasetSample,
)

import apsw

SQLiteValue = Any


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
        get_columns: Callable[[Any], Iterable[str]],
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
        import re

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

    def BestIndexObject(self, o: apsw.IndexInfo) -> bool:
        print(f"BestIndexObject {self.param_values} {o.nConstraint} constraints")
        idx_str: list[str] = []
        # param_start = len(self.module.columns)
        for c in range(o.nConstraint):
            constrained_column = self.columns[o.get_aConstraint_iColumn(c)]

            if not o.get_aConstraint_usable(c):
                continue

            if o.get_aConstraint_op(c) != apsw.SQLITE_INDEX_CONSTRAINT_EQ:
                print(f"Skipped constraint on {constrained_column}")
                continue

            print(f"{constrained_column} is constrained by ==")
            o.set_aConstraintUsage_argvIndex(c, len(idx_str) + 1)
            o.set_aConstraintUsage_omit(c, True)

            assert constrained_column not in idx_str
            idx_str.append(constrained_column)

        print(f"list of constrained columns: {idx_str}")
        o.idxStr = ",".join(idx_str)
        if len(idx_str) > 0:
            o.estimatedRows = 1
        else:
            # say there are a huge number of rows so the query planner avoids us
            o.estimatedRows = 2147483647
        return True

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
        print(f"{(self.param_values)} Filter({idx_str}, {args})")
        params: dict[str, SQLiteValue] = self.param_values.copy()
        params.update(zip(idx_str.split(","), args))
        self.iterating = iter(self.callable(**params))
        # proactively advance so we can tell if eof
        self.Next()

    def Eof(self) -> bool:
        return self.iterating is None

    def Close(self) -> None:
        if self.iterating:
            if hasattr(self.iterating, "close"):
                self.iterating.close()
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
    get_columns: Callable[[Any], Iterable[str]],
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
        use_bestindex_object=True,
        eponymous=eponymous,
        eponymous_only=eponymous_only,
        read_only=True,
    )


from .schema import assign_names, SchemaNames


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


def query_matrix_dataset(db, dataset_id):
    raise NotImplementedError()


def _query_matrix_dataset_dimension(
    db,
    matrix_dataset: MatrixDataset,
    dimension_subtype_cls: Union[Type[DatasetFeature], Type[DatasetSample]],
):
    metadata_col_name = "label"
    if dimension_subtype_cls == DatasetFeature:
        dimension_type = matrix_dataset.feature_type
    else:
        assert dimension_subtype_cls == DatasetSample
        dimension_type = matrix_dataset.sample_type

    id_and_labels = crud_dataset.get_metadata_used_in_matrix_dataset(
        db, dimension_type, matrix_dataset, dimension_subtype_cls, metadata_col_name,
    )

    return sorted(id_and_labels.keys())


def query_matrix_dataset_samples(db, dataset_id):
    matrix_dataset = crud_dataset.get_dataset(db, db.user, dataset_id)
    assert isinstance(matrix_dataset, MatrixDataset)

    for dim_id in _query_matrix_dataset_dimension(db, matrix_dataset, DatasetSample):
        yield (dim_id,)


def query_matrix_dataset_features(db, dataset_id):
    matrix_dataset = crud_dataset.get_dataset(db, db.user, dataset_id)
    assert isinstance(matrix_dataset, MatrixDataset)

    for dim_id in _query_matrix_dataset_dimension(db, matrix_dataset, DatasetFeature):
        yield (dim_id,)


import time


def query_tabular_dataset(db, index_cache, columns, dataset_id, **constraints):
    print("dataset_id", dataset_id, constraints)
    start = time.time()
    # not efficient, but first goal is something that works:
    if dataset_id not in index_cache:
        dataset = crud_dataset.get_dataset(db, db.user, dataset_id)
        assert isinstance(dataset, TabularDataset)
    else:
        dataset = index_cache[dataset_id]
    print(f"a {time.time() - start:.2f} seconds")

    print("dataset", dataset.name)
    start = time.time()
    if len(constraints) > 0:
        # construct an index to avoid slow lookups. If we need to look up via a particular key,
        # we'll probably need to use that combo again (if it's due to a join), so cache the table indexed that way.
        constraint_columns = sorted(constraints.keys())
        index_key = tuple([dataset_id] + constraint_columns)
        if index_key not in index_cache:
            # build indexed version of table
            print(f"e {time.time() - start:.2f} seconds")
            start = time.time()
            df = crud_dataset.get_subset_of_tabular_data_as_df(db, dataset, None, None)

            extra_columns = set(constraints.keys()).difference(df.columns)
            assert (
                len(extra_columns) == 0
            ), f"Constraints provided for {extra_columns} but the columns were {df.columns}"

            print(f"f {time.time() - start:.2f} seconds")
            start = time.time()
            by_key = {}
            for rec in df.to_records():
                key = tuple(
                    [rec[constraint_column] for constraint_column in constraint_columns]
                )
                if key not in by_key:
                    by_key[key] = [rec]
                else:
                    by_key[key].append(rec)
            print(f"g {time.time() - start:.2f} seconds")
            start = time.time()
            index_cache[index_key] = by_key
            print(f"h {time.time() - start:.2f} seconds")
            start = time.time()

        recs = index_cache[index_key].get(
            tuple(
                [
                    constraints[constraint_column]
                    for constraint_column in constraint_columns
                ]
            ),
            [],
        )
        print(f"d {time.time() - start:.2f} seconds")
        start = time.time()
    else:
        print(f"c {time.time() - start:.2f} seconds")
        start = time.time()
        df = crud_dataset.get_subset_of_tabular_data_as_df(db, dataset, None, None)
        recs = df.to_records()
    print(f"b {time.time() - start:.2f} seconds")

    for row in recs:
        yield [row[column] for column in columns]

    # # apply constraints
    # for column_name, column_value in constraints.items():
    #     df = df[df[column_name] == column_value]
    #
    # # return rows
    # for row in df.to_records():
    #     yield [row[column] for column in columns]


def create_db_with_virtual_schema(db: SessionWithUser):
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
        lambda **args: query_matrix_dataset(db, **args),
        lambda **args: ("sample_id", "feature_id", "value"),
        ("dataset_id",),
    )

    make_virtual_module(
        connection,
        "query_matrix_dataset_samples",
        lambda **args: query_matrix_dataset_samples(db, **args),
        lambda **args: ("sample_id",),
        ("dataset_id",),
    )

    make_virtual_module(
        connection,
        "query_matrix_dataset_features",
        lambda **args: query_matrix_dataset_features(db, **args),
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


from breadbox.utils.profiling import profiled_region

import sqlglot
import csv
import io


def assert_single_select(sql: str):
    parsed = sqlglot.parse(sql, dialect="sqlite")
    assert len(parsed) == 1
    assert isinstance(parsed[0], sqlglot.expressions.Select)


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


def stream_cursor_as_csv(cursor, cleanup_callback):
    try:
        with profiled_region("stream_cursor_as_csv"):
            to_row = create_to_row_func()
            column_names = [description[0] for description in cursor.description]
            # write out column names as first row
            yield to_row(column_names)

            # write out all rows
            for row in cursor:
                yield to_row(row)
    finally:
        cleanup_callback()


def execute_sql_in_virtual_db(db: SessionWithUser, sql_statement: str):
    with profiled_region("execute_sql_in_virtual_db"):
        assert_single_select(sql_statement)

        with profiled_region("create_db_with_virtual_schema"):
            virtual_db_connection = create_db_with_virtual_schema(db)
            cursor = virtual_db_connection.cursor()

        qd = apsw.ext.query_info(
            virtual_db_connection,
            sql_statement,
            actions=True,  # which tables/views etc and how they are accessed
            explain=True,  # shows low level VDBE
            explain_query_plan=True,  # how SQLite solves the query
        )

        from pprint import pprint

        print("query", qd.query)
        print("\nbindings_count", qd.bindings_count)
        print("\nbindings_names", qd.bindings_names)
        print("\nexpanded_sql", qd.expanded_sql)
        print("\nfirst_query", qd.first_query)
        print("\nquery_remaining", qd.query_remaining)
        print("\nis_explain", qd.is_explain)
        print("\nis_readonly", qd.is_readonly)
        print("\ndescription")
        pprint(qd.description)
        if hasattr(qd, "description_full"):
            print("\ndescription_full")
            pprint(qd.description_full)

        print("\nquery_plan")
        pprint(qd.query_plan)
        print("\nFirst 5 actions")
        pprint(qd.actions[:5])
        print("\nFirst 5 explain")
        pprint(qd.explain[:5])

        with profiled_region("execute statement"):
            cursor.execute("select 1")
        #            cursor.execute(sql_statement)

        def cleanup_callback():
            # this might all automatically get cleaned up by the GC, but let's clean it up like we're supposed to
            # just in case
            cursor.close()
            virtual_db_connection.close()

    return stream_cursor_as_csv(cursor, cleanup_callback)
