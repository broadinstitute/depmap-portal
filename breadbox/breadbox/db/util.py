from breadbox.db.session import SessionLocalWithUser
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


def fetch_raw_rows(connection, statement) -> list:
    """
    Run a SELECT and return the DBAPI's own row tuples.

    SQLAlchemy wraps every row in a Row object, which for a few hundred thousand rows
    costs more than the query. Skipping that also skips result processors, so only use
    this when every selected column is plain text or a number.
    """
    result = connection.execute(statement)
    try:
        return result.cursor.fetchall()
    finally:
        result.close()


@contextmanager
def transaction(db: Session):
    try:
        yield
        db.commit()
    except:
        db.rollback()
        raise
