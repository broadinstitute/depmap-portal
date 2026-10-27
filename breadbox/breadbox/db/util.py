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


@contextmanager
def transaction(db: Session):
    try:
        yield
        db.commit()
    except:
        db.rollback()
        raise
