from __future__ import annotations
from typing import Callable, Iterator, Any, Union, List, Tuple, Dict

import apsw
import pytest

from dataclasses import dataclass

from breadbox.db.session import SessionWithUser
from ..schemas.dataset import AnnotationType


@dataclass(frozen=True)
class MatrixTableMapping:
    dataset_id: str
    name: str


@dataclass(frozen=True)
class TabularTableMapping:
    dataset_id: str
    name: str
    columns: List


import re


def _sanitize(name, max_len=30):
    # turn any non-alphanumeric characters into _
    name = re.sub("[^a-z0-9_]", "_", name.lower())

    # make sure name doesn't start with a number
    if re.match("[0-9]+.*", name):
        name = "_" + name

    # turn multiple "_" into a single "_"
    name = re.sub("_+", "_", name)

    # make sure the name isn't too long
    name = name[:max_len]

    # make sure the final result satisfies the constraints
    assert re.match("[a-z_]+[a-z0-9_]*", name)
    return name


def add_suffix_if_needed(name: str, used_names: set, max_tries=100):
    if name not in used_names:
        return name
    for i in range(max_tries):
        with_prefix = f"{name}_{i+1}"
        if with_prefix not in used_names:
            return with_prefix
    raise Exception(f"too many attempts to get a unique name for {name}")


def sanitize_names(names: List[str]) -> Dict[str, str]:
    """Given a list of names, return a map of those names to unique sanitized names.
    For example: ["a", "A", "a!"] -> {"a": "a", "a": "a_1", "a!": "a_"}
    """
    used_names = set()
    name_to_sanitized = {}

    for name in names:
        sanitized = add_suffix_if_needed(_sanitize(name), used_names)
        used_names.add(sanitized)
        name_to_sanitized[name] = sanitized

    return name_to_sanitized


def make_virtual_module(
    db: apsw.Connection,
    name: str,
    callable: Callable,
    columns: Tuple[str],
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

    class Module:
        def __init__(
            self,
            callable: Callable,
            columns: tuple[str],
            parameters: tuple[str],
            repr_invalid: bool,
        ):
            self.columns = columns
            self.callable: Callable = callable
            self.repr_invalid = repr_invalid
            self.parameters = parameters

            column_defs = ""
            for i, c in enumerate(self.columns):
                if column_defs:
                    column_defs += ", "
                column_defs += f"[{c}]"

            self.schema = f"CREATE TABLE ignored({column_defs})"

        def Create(
            self, db, modulename, dbname, tablename, *args: apsw.SQLiteValue
        ) -> tuple[str, apsw.VTTable]:
            if len(args) > len(self.parameters):
                raise ValueError(
                    f"Too many parameters: parameters accepted are {' '.join(self.parameters)}"
                )

            param_values = dict(zip(self.parameters, args))
            print(f"schema={self.schema}")
            print(f"param_values={param_values}")
            return self.schema, self.Table(self, param_values)  # type: ignore[return-value]

        Connect = Create

        class Table:
            def __init__(self, module, param_values: dict[str, apsw.SQLiteValue]):
                self.module = module
                self.param_values = param_values
                print(f"Table.__init__: {(self.param_values)}")

            def BestIndexObject(self, o: apsw.IndexInfo) -> bool:
                idx_str: list[str] = []
                # param_start = len(self.module.columns)
                for c in range(o.nConstraint):
                    constrained_column = self.module.columns[
                        o.get_aConstraint_iColumn(c)
                    ]

                    if not o.get_aConstraint_usable(c):
                        continue

                    if o.get_aConstraint_op(c) != apsw.SQLITE_INDEX_CONSTRAINT_EQ:
                        return False

                    o.set_aConstraintUsage_argvIndex(c, len(idx_str) + 1)
                    o.set_aConstraintUsage_omit(c, True)

                    assert constrained_column not in idx_str
                    idx_str.append(constrained_column)

                o.idxStr = ",".join(idx_str)
                # say there are a huge number of rows so the query planner avoids us
                o.estimatedRows = 2147483647
                return True

            def Open(self):
                return self.module.Cursor(self.module, self.param_values)

            def Disconnect(self) -> None:
                pass

            Destroy = Disconnect

        class Cursor:
            def __init__(self, module, param_values: dict[str, apsw.SQLiteValue]):
                self.module = module
                self.param_values = param_values
                self.iterating: Union[Iterator[apsw.SQLiteValues], None] = None
                self.current_row: Any = None
                self.columns = module.columns
                self.repr_invalid = module.repr_invalid
                self.num_columns = len(self.columns)
                print(f"Cursor.__init__: {(self.param_values)}")

            def Filter(
                self, idx_num: int, idx_str: str, args: tuple[apsw.SQLiteValue]
            ) -> None:
                params: dict[str, apsw.SQLiteValue] = self.param_values.copy()
                params.update(zip(idx_str.split(","), args))
                self.iterating = iter(self.module.callable(**params))
                # proactively advance so we can tell if eof
                self.Next()

            def Eof(self) -> bool:
                return self.iterating is None

            def Close(self) -> None:
                if self.iterating:
                    if hasattr(self.iterating, "close"):
                        self.iterating.close()
                    self.iterating = None

            def Column(self, which: int) -> apsw.SQLiteValue:
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

    mod = Module(callable, columns, parameters, repr_invalid,)

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


from ..crud import dataset as crud_dataset
from ..crud import dimension_types as crud_dimension_types
from ..models.dataset import MatrixDataset, TabularDataset, Dataset, DimensionType


def _fk_constraint_name(table_name, sample_id_column):
    return f"fk_{table_name}_{sample_id_column}"


class SchemaNames:
    def __init__(
        self,
        table_name_by_dataset_id,
        table_pk_by_dataset_id,
        metadata_dataset_id_by_type,
    ):
        self.table_name_by_dataset_id = table_name_by_dataset_id
        self.table_pk_by_dataset_id = table_pk_by_dataset_id
        self.metadata_dataset_id_by_type = metadata_dataset_id_by_type

    def get_dataset_table_name(self, dataset_id: str):
        return self.table_name_by_dataset_id[dataset_id]

    def get_tabular_dataset_pk(self, dataset_id: str):
        return self.table_pk_by_dataset_id[dataset_id]

    def get_metadata_dataset_id_for_type(self, type_name: str):
        return self.metadata_dataset_id_by_type[type_name]


def _get_create_table_for_matrix(dataset: MatrixDataset, schema: SchemaNames) -> str:
    clauses = []

    table_name = schema.get_dataset_table_name(dataset.id)

    # hardcoding these names -- but maybe the name should be based on the metadata table they're joining to?
    sample_id_column = "sample_id"
    feature_id_column = "feature_id"

    # add columns
    clauses.append(f'"{sample_id_column}" VARCHAR NOT NULL')
    clauses.append(f'"{feature_id_column}" VARCHAR NOT NULL')
    clauses.append(f'"value" FLOAT')

    # add PK
    clauses.append(
        f"CONSTRAINT pk_{table_name} PRIMARY KEY ({feature_id_column}, {sample_id_column})"
    )

    # add KFs
    sample_type_metadata_id = dataset.sample_type.dataset.id
    sample_metadata_table = schema.get_dataset_table_name(sample_type_metadata_id)
    sample_metadata_pk = schema.get_tabular_dataset_pk(dataset.sample_type_name)
    clauses.append(
        f'CONSTRAINT {_fk_constraint_name(table_name, sample_id_column)} ({sample_id_column}) REFERENCES "{sample_metadata_table}" ("{sample_metadata_pk}")'
    )
    if dataset.feature_type_name is not None:
        feature_type_metadata_id = dataset.feature_type.dataset.id
        feature_metadata_table = schema.get_dataset_table_name(feature_type_metadata_id)
        feature_metadata_pk = schema.get_tabular_dataset_pk(dataset.feature_type_name)
        clauses.append(
            f'CONSTRAINT {_fk_constraint_name(table_name, feature_id_column)} ({feature_id_column}) REFERENCES "{feature_metadata_table}" ("{feature_metadata_pk}")'
        )

    # add some leading space to make it more readable
    clauses = [f"    {x}" for x in clauses]

    return f"""CREATE TABLE \"{table_name}\" (
{",".join(clauses)}
);
"""


annotation_type_to_sql_type = {
    AnnotationType.continuous: "FLOAT",
    AnnotationType.categorical: "VARCHAR",
    AnnotationType.list_strings: "VARCHAR",
    AnnotationType.text: "VARCHAR",
}


def _get_create_table_for_tabular(dataset: TabularDataset, schema: SchemaNames) -> str:
    clauses = []

    table_name = schema.get_dataset_table_name(dataset.id)
    pk_column = schema.get_tabular_dataset_pk(dataset.id)

    # add columns
    for column_name, column_metadata in dataset.columns_metadata.items():
        sql_type = annotation_type_to_sql_type[column_metadata.col_type]
        if column_name == pk_column:
            clauses.append(f'"{column_name}" {sql_type} NOT NULL')
        else:
            clauses.append(f'"{column_name}" {sql_type}')

    # add PK
    clauses.append(f"CONSTRAINT pk_{table_name} PRIMARY KEY ({pk_column})")

    # add KFs
    for column_name, column_metadata in dataset.columns_metadata.items():
        if column_metadata.references:
            ref_metadata_dataset_id = schema.get_metadata_dataset_id_for_type(
                column_metadata.references
            )
            ref_table_name = schema.get_dataset_table_name(ref_metadata_dataset_id)
            ref_pk_column = schema.get_tabular_dataset_pk(ref_metadata_dataset_id)
            clauses.append(
                f'CONSTRAINT {_fk_constraint_name(table_name, column_name)} ({column_name}) REFERENCES "{ref_table_name}" ("{ref_pk_column}")'
            )

    # add some leading space to make it more readable
    clauses = [f"    {x}" for x in clauses]
    clauses_str = ",\n".join(clauses)

    return f"""CREATE TABLE \"{table_name}\" (
{clauses_str}
);
"""


def assign_names(datasets: List[Dataset], dim_types: List[DimensionType]):
    dataset_names = [x.name for x in datasets]
    sanitized_names = sanitize_names(dataset_names)
    table_name_by_dataset_id = {x.id: sanitized_names[x.name] for x in datasets}

    dim_type_by_name = {x.name: x for x in dim_types}

    table_pk_by_dataset_id = {
        x.id: dim_type_by_name[x.index_type_name].id_column
        for x in datasets
        if isinstance(x, TabularDataset)
    }

    metadata_dataset_id_by_type = {x.name: x.dataset_id for x in dim_types}

    return SchemaNames(
        table_name_by_dataset_id=table_name_by_dataset_id,
        table_pk_by_dataset_id=table_pk_by_dataset_id,
        metadata_dataset_id_by_type=metadata_dataset_id_by_type,
    )


def generate_simulated_schema(db: SessionWithUser):
    datasets = crud_dataset.get_datasets(db, db.user)
    dim_types = crud_dimension_types.get_dimension_types(db)

    schema = assign_names(datasets, dim_types)

    all_statements = []
    for dataset in datasets:
        if isinstance(dataset, MatrixDataset):
            statements = _get_create_table_for_matrix(dataset, schema)
        elif isinstance(dataset, TabularDataset):
            statements = _get_create_table_for_tabular(dataset, schema)
        else:
            raise Exception("Unknown dataset type")
        all_statements.append(statements)
    # return repr(all_statements)
    return "\n".join(all_statements)
