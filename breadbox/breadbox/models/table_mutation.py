from typing import List

from sqlalchemy import DDL, Integer, String, Table, event
from sqlalchemy.orm import Mapped, mapped_column

from breadbox.db.base_class import Base

# NOTE: Triggers are dropped by SQLite whenever a table is dropped. Alembic runs
# with render_as_batch=True, which rebuilds a table (copy + drop) for most ALTERs,
# so any migration that does `batch_alter_table(<tracked table>)` must recreate the
# triggers afterwards (see `mutation_trigger_statements`).

EVENTS = ("INSERT", "UPDATE", "DELETE")

# Names of the tables which have mutation triggers registered. Used to seed
# the rows in table_mutation.
_tracked_tables: List[str] = []


class TableMutation(Base):
    """
    One row per tracked table. `count` is incremented by a trigger every time a row
    in that table is inserted, updated or deleted, so a changed count means the table
    has been mutated since it was last read (useful for cache invalidation).
    """

    __tablename__ = "table_mutation"

    name: Mapped[str] = mapped_column(String, nullable=False, primary_key=True)
    count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )


def trigger_name(table_name: str, trigger_event: str) -> str:
    return f"trg_{table_name}_{trigger_event.lower()}_mutation"


def mutation_trigger_statements(table_name: str) -> List[str]:
    """SQL to create the mutation triggers for a table. Shared by the models and migrations."""
    return [
        f"CREATE TRIGGER IF NOT EXISTS {trigger_name(table_name, e)} "
        f"AFTER {e} ON {table_name} "
        f"BEGIN UPDATE table_mutation SET count = count + 1 WHERE name = '{table_name}'; END"
        for e in EVENTS
    ]


def drop_mutation_trigger_statements(table_name: str) -> List[str]:
    return [f"DROP TRIGGER IF EXISTS {trigger_name(table_name, e)}" for e in EVENTS]


def seed_statement(table_name: str) -> str:
    return (
        f"INSERT OR IGNORE INTO table_mutation (name, count) VALUES ('{table_name}', 0)"
    )


def register_mutation_triggers(table: Table) -> None:
    """Have metadata.create_all() create the triggers (and seed row) for `table`."""
    _tracked_tables.append(table.name)
    for statement in mutation_trigger_statements(table.name):
        event.listen(table, "after_create", DDL(statement))


@event.listens_for(TableMutation.__table__, "after_create")
def _seed_rows(target, connection, **kwargs):
    for table_name in _tracked_tables:
        connection.exec_driver_sql(seed_statement(table_name))
