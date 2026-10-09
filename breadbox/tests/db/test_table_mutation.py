import os
import subprocess
import sqlite3

from sqlalchemy import text

from breadbox.crud.access_control import PUBLIC_GROUP_ID


def _count(db, name="dataset"):
    return db.execute(
        text("SELECT count FROM table_mutation WHERE name = :name"), {"name": name}
    ).scalar_one()


def test_dataset_triggers_increment_count(minimal_db):
    db = minimal_db
    start = _count(db)

    db.execute(
        text(
            "INSERT INTO dataset (id, name, format, data_type, is_transient, group_id) "
            "VALUES ('d1', 'a', 'matrix_dataset', 'User upload', 0, :g)"
        ),
        {"g": PUBLIC_GROUP_ID},
    )
    assert _count(db) == start + 1

    db.execute(text("UPDATE dataset SET name = 'b' WHERE id = 'd1'"))
    assert _count(db) == start + 2

    db.execute(text("DELETE FROM dataset WHERE id = 'd1'"))
    assert _count(db) == start + 3


def test_other_tables_do_not_increment_dataset_count(minimal_db):
    db = minimal_db
    start = _count(db)
    db.execute(text("UPDATE data_type SET data_type = data_type"))
    assert _count(db) == start


def test_alembic_migration_creates_and_drops_triggers(tmpdir):
    db_path = str(tmpdir.join("migrated.sqlite3"))
    env = dict(os.environ, SQLALCHEMY_DATABASE_URL=f"sqlite:///{db_path}")
    root = os.path.join(os.path.dirname(__file__), "..", "..")

    def trigger_names():
        conn = sqlite3.connect(db_path)
        try:
            return {
                r[0]
                for r in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'trigger'"
                )
            }
        finally:
            conn.close()

    subprocess.run(["alembic", "upgrade", "head"], cwd=root, env=env, check=True)
    assert {
        "trg_dataset_insert_mutation",
        "trg_dataset_update_mutation",
        "trg_dataset_delete_mutation",
    } <= trigger_names()

    subprocess.run(
        ["alembic", "downgrade", "bd6abe9454f9"], cwd=root, env=env, check=True
    )
    assert not any(n.startswith("trg_dataset_") for n in trigger_names())
