from __future__ import annotations
from typing import Callable, Iterator, Any, Union, List, Tuple

import apsw
import pytest

from dataclasses import dataclass


@dataclass(frozen=True)
class MatrixTableMapping:
    dataset_id: str
    name: str


@dataclass(frozen=True)
class TabularTableMapping:
    dataset_id: str
    name: str
    columns: List


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


import apsw.ext


def test_virtual_table():
    """Tests SELECTs with and without WHERE clauses from the virtual table."""

    # This is the function that will generate our data
    def get_matrix_data(offset=None, sample_id=None, feature_id=None):
        """
        Generator function that yields matrix data.
        Can be filtered by sample_id and/or feature_id.
        """
        print(f"Called get_matrix_data({sample_id}, {feature_id})")
        if offset is None:
            offset_v = 0
        else:
            offset_v = float(offset)
        data = [
            ("sample1", "feature1", 1.1 + offset_v),
            ("sample1", "feature2", 1.2 + offset_v),
            ("sample2", "feature1", 2.1 + offset_v),
            ("sample2", "feature2", 2.2 + offset_v),
        ]
        for sample_id_, feature_id_, value in data:
            if sample_id and sample_id_ != sample_id:
                continue
            if feature_id and feature_id_ != feature_id:
                continue
            yield (sample_id_, feature_id_, value)

    connection = apsw.Connection(":memory:")
    make_virtual_module(
        connection,
        "get_matrix_data",
        get_matrix_data,
        ("sample_id", "feature_id", "value"),
        ("offset",),
    )

    connection.execute(
        "CREATE VIRTUAL TABLE v_get_matrix_data using get_matrix_data(100)"
    )

    print(apsw.ext.format_query_table(connection, "select * from v_get_matrix_data"))
    #
    # print(apsw.ext.format_query_table(connection, "select sample_id, feature_id, value from v_get_matrix_data"))

    print(
        apsw.ext.format_query_table(
            connection, "select * from get_matrix_data() where sample_id = 'sample1'"
        )
    )

    print(
        apsw.ext.format_query_table(
            connection, "select * from get_matrix_data() where feature_id = 'feature1'"
        )
    )

    print(
        apsw.ext.format_query_table(
            connection,
            "select * from get_matrix_data() where feature_id = 'feature1' and sample_id = 'sample1'",
        )
    )

    # cursor = connection.cursor()
    #
    # cursor.execute("CREATE VIRTUAL TABLE matrix USING matrix_data(sample_id TEXT, feature_id TEXT, value REAL)")
    #
    # # Test full table scan (no constraints)
    # results_all = list(cursor.execute("SELECT * FROM matrix"))
    # expected_all = [
    #     ("sample1", "feature1", 1.1),
    #     ("sample1", "feature2", 1.2),
    #     ("sample2", "feature1", 2.1),
    #     ("sample2", "feature2", 2.2),
    # ]
    # assert results_all == expected_all
    #
    # # Test filtering by sample_id
    # results_sample1 = list(cursor.execute("SELECT * FROM matrix WHERE sample_id = 'sample1'"))
    # expected_sample1 = [
    #     ("sample1", "feature1", 1.1),
    #     ("sample1", "feature2", 1.2),
    # ]
    # assert results_sample1 == expected_sample1
    #
    # # Test filtering by sample_id and feature_id
    # results_filtered = list(cursor.execute("SELECT * FROM matrix WHERE sample_id = 'sample2' AND feature_id = 'feature2'"))
    # expected_filtered = [
    #     ("sample2", "feature2", 2.2),
    # ]
    # assert results_filtered == expected_filtered
    #
    # # Test with no results
    # results_none = list(cursor.execute("SELECT * FROM matrix WHERE sample_id = 'nonexistent'"))
    # assert results_none == []
