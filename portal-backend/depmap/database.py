# -*- coding: utf-8 -*-

import contextlib
import logging
import resource
import threading
from collections import defaultdict
from typing import Dict, List, Optional, Type, TypeVar, Union

import flask_sqlalchemy
import sqlalchemy
from sqlalchemy import event
from sqlalchemy.engine import Engine

from .extensions import db

log = logging.getLogger(__name__)

"""Database module, including the SQLAlchemy database object and DB-related utilities."""

# Alias common SQLAlchemy names
Column = sqlalchemy.Column
relationship = db.relationship
Integer: Type[sqlalchemy.Integer] = db.Integer
ForeignKey: Type[sqlalchemy.ForeignKey] = db.ForeignKey
Float: Type[sqlalchemy.Float] = db.Float
String: Type[sqlalchemy.String] = db.String
Boolean: Type[sqlalchemy.Boolean] = db.Boolean
Text: Type[sqlalchemy.Text] = db.Text


DBModel: flask_sqlalchemy.Model = db.Model
# "Generic" type
T = TypeVar("T", bound="Model")
# Import this one to avoid mypy errors + use typed helper methods
class Model(DBModel):
    __abstract__ = True

    # @classmethod
    # def get(cls: Type[T], id: str) -> T:
    #     return cls.query.get(id)

    @classmethod
    def get_by(cls: Type[T], **kw) -> Optional[T]:
        return cls.query.filter_by(**kw).one_or_none()

    @classmethod
    def get_all(cls: Type[T], **kw) -> List[T]:
        return cls.query.all()

    @classmethod
    def get_all_by(cls: Type[T], **kw) -> List[T]:
        return cls.query.filter_by(**kw).all()


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """
    Sqlite by default does not enforce the legitimacy of foreign keys
    This turns this enforcement/constraint on
    """
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


class Checkpoint(Model):
    __tablename__ = "checkpoint"
    id = Column(Integer, primary_key=True, autoincrement=True)
    label = Column(String(80), nullable=False, unique=True)
    status = Column(String(80))


@contextlib.contextmanager
def clear_checkpoint(label):
    existing_checkpoint = Checkpoint.query.filter_by(label=label).one_or_none()
    if existing_checkpoint:
        with transaction():
            log.info("Clearing checkpoint {}".format(label))
            yield True
            db.session.delete(existing_checkpoint)
            log.info('Completed checkpoint clear "{}"'.format(label))
    else:
        yield False


import os


@contextlib.contextmanager
def checkpoint(label, force=False, skip=False, record_skip=False):

    existing_checkpoint = Checkpoint.query.filter_by(label=label).one_or_none()
    if existing_checkpoint:
        if force:
            # debugging issue with "cannot create thread" when running db recreate under GCP. That error suggests that the number of threads is growing
            # to exhaustion so print out a message to confirm
            print(
                "active threads: {}, memory used: {}".format(
                    threading.active_count(),
                    resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
                )
            )
            os.system("df -k")

            with transaction():
                log.info(
                    'Rerunning checkpoint (status={}) "{}" again per request'.format(
                        existing_checkpoint.status, label
                    )
                )
                yield True
                existing_checkpoint.status = "applied"
            log.info('Completed checkpoint "{}"'.format(label))
        else:
            log.info(
                "Skipping checkpoint {} (status={})".format(
                    label, existing_checkpoint.status
                )
            )
            yield False
    else:
        if skip:
            log.info(
                'Checkpoint "{}" not yet applied, but there was an explict request to skip, so skipping.'.format(
                    label
                )
            )
            if record_skip:
                log.info("Recording checkpoint skipped")
                with transaction():
                    db.session.add(Checkpoint(label=label, status="skipped"))
            yield False
        else:
            with transaction():
                log.info('Checkpoint "{}" not yet applied.'.format(label))
                yield True
                db.session.add(Checkpoint(label=label, status="applied"))
                log.info('Completed checkpoint "{}"'.format(label))


_db = db
_tx_state_per_session: Dict[int, List[Union[int, bool]]] = defaultdict(
    lambda: [0, False]
)


# TODO: Write docs on when to use transaction vs transactional


@contextlib.contextmanager
def transaction(db=None):
    if db is None:
        db = _db

    session_id = id(db.session)
    tx_state = _tx_state_per_session[session_id]

    if tx_state is None or tx_state[0] == 0:
        # entering the first transaction in the stack
        # do a rollback to clear any open transaction and then let the new transaction be opened implictly
        db.session.rollback()
        # set the state as a tuple of (depth, rolled_back)
        tx_state = [0, False]

    tx_state[0] += 1
    _tx_state_per_session[session_id] = tx_state

    try:
        yield
    except:
        if not tx_state[1]:
            # if we haven't rolled back already, do so now
            tx_state[1] = True
            # print("doing rollback")
            db.session.rollback()

        tx_state[0] -= 1
        # print("raising")
        raise

    tx_state[0] -= 1

    # print("exiting transaction", tx_state)
    if tx_state[0] == 0:
        if not tx_state[1]:
            # print("committing")
            db.session.commit()
            # print("exiting top transaction")


# def transactional(f=None, db=None):
#     if db is None:
#         db = _db
#
#     def apply_decorator(f):
#         @wraps(f)
#         def wrapper(*args, **kwargs):
#             with transaction(db):
#                 return f(*args, **kwargs)
#
#         return wrapper
#
#     if f is None:
#         assert db is not None
#         return apply_decorator
#     else:
#         return apply_decorator(f)
