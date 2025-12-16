from typing import Optional
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.engine import Engine
from sqlalchemy.orm.query import Query
from sqlalchemy import event
import sqlite3

from breadbox.config import get_settings
from breadbox.crud.access_control import get_read_access_group_ids

# NOTE: Uncomment the following to have SQLAlchemy log to the console all SQL statements and their parameters
# import logging

# logging.basicConfig()
# logging.getLogger("sqlalchemy.engine").setLevel(logging.DEBUG)


class SessionWithUser(Session):
    _user: Optional[str] = None

    # a references to the sessionmaker used to create this. Needed for create_session_for_anonymous_user
    _sessionmaker = None

    read_group_ids: Optional[list] = None

    # Determines whether groups will be cached for the length of this database session
    # For real API requests this is safe to do (user permissions aren't expected to change mid-request)
    # But in tests, admin users need to gain access to any groups that are added mid-test.
    # Also, the user may need to change in the middle of a test, whereas that should not be
    # allowed outside of tests.
    is_test_db_session: bool = False

    @property
    def user(self) -> str:
        """Read-only user value"""
        assert self._user is not None, "User is not yet set on the database session"
        return self._user

    def set_user(self, user: str, sessionmaker):
        assert (
            self._user is None and self._sessionmaker is None
        ), "The session user or sessionmaker cannot not be updated once it's set. For changing users in tests, use reset_user."
        self._user = user
        self._sessionmaker = sessionmaker

    def create_session_for_anonymous_user(self) -> "SessionWithUser":
        """
        Creates a new session not tied to the current user, but instead a user named "anonymous". This
        is primarily useful for times when we want to make a DB call that we're going to cache, so we
        want to make sure it cannot see any private data.
        """
        session = self._sessionmaker()
        session.set_user("anonymous", self._sessionmaker)
        return session

    def get_read_group_ids(self):
        # If the group_ids haven't been set yet or caching is off
        if self.read_group_ids is None or self.is_test_db_session:
            assert (
                self.user is not None
            ), "User must be set on SessionWithUser before querying."
            self.read_group_ids = get_read_access_group_ids(db=super(), user=self.user)
        return self.read_group_ids

    def reset_user(self, user):
        """
        In unit tests, a single database session is used for the entire test so that uncommitted 
        changes can be rolled back at the end. As a result, it's necessary to explicitely 
        update the user on the session whenever the user changes mid-test.
        This is automatically called whenever api requests are made in tests. 
        """
        assert (
            self.is_test_db_session
        ), "Outside of testing, the user should never be reset"
        self._user = user
        # caching should be turned off but just in case, clear the cache
        self.read_group_ids = None

    def query(self, entity, **kwargs) -> Query:  # type: ignore[override]
        # NOTE: query() has been deprecated in favor of select() in SQLAlchemy 2.0
        # However, since the Query API usually represents the vast majority of database access code within an application, the majority of the Query API is not being removed from SQLAlchemy.
        # The Query object behind the scenes now translates itself into a 2.0 style select() object when the Query object is executed, so it now is just a very thin adapter API.
        return (
            super()
            .query(entity, **kwargs)
            .execution_options(filter_group_ids=self.get_read_group_ids())
        )


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if type(dbapi_connection) is sqlite3.Connection:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        # Turn on Write-Ahead Logging to allow reads while writes are in progress
        cursor.execute("PRAGMA journal_mode=WAL;")
        # allow sqlite to use 1GB
        sqlite3_memory_in_kb = 1024 * 1024
        cursor.execute("PRAGMA cache_size = -{}".format(sqlite3_memory_in_kb))
        cursor.close()


def SessionLocalWithUser(user: str) -> SessionWithUser:
    settings = get_settings()

    engine = create_engine(
        settings.sqlalchemy_database_url,
        connect_args={"check_same_thread": False},
        future=True,
    )

    l = sessionmaker(
        autoflush=False,
        bind=engine,
        class_=SessionWithUser,
        future=True,  # In SQLAlchemy 2.0, autocommit is deprecated
    )
    session = l()
    session.set_user(user, l)
    return session
