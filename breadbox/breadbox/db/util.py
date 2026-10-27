import json

from breadbox.db.session import SessionLocalWithUser
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from contextlib import contextmanager


@contextmanager
def db_context(user: str, commit=False):
    db = SessionLocalWithUser(user)
    try:
        if commit:
            with transaction(db):
                yield db
        else:
            yield db
    finally:
        db.close()


def fetch_columns_in_one_step(connection, statement) -> list:
    """
    Run a SELECT and return its columns as lists (one per selected column, in the
    statement's row order), with SQLite packing each column into a JSON array.

    Reading a few hundred thousand rows through the usual row-at-a-time cursor is slow
    twice over: SQLAlchemy wraps every row in an object, and Python's sqlite3 gives up and
    retakes the GIL around every row, which makes concurrent reads slower than running
    them one after another. Here Python makes a single call into SQLite, which does its
    work with the GIL released. Columns rather than rows because a list per row is what
    makes parsing slow, and each of those lists is a stall for every other thread.

    SQLite only, and every selected column must be plain text or a number.
    """
    subquery = statement.subquery()
    packed = select(
        *[func.json_group_array(column) for column in subquery.c]
    ).select_from(subquery)
    return [json.loads(column) for column in connection.execute(packed).one()]


@contextmanager
def transaction(db: Session):
    try:
        yield
        db.commit()
    except:
        db.rollback()
        raise
