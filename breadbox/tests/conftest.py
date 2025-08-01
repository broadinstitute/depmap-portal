from contextlib import contextmanager
import copy
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from fastapi.exceptions import HTTPException

from breadbox.api.dependencies import get_db_with_user, get_user
from breadbox.utils.progress_tracker import ProgressTracker
from breadbox.config import Settings, get_settings
from breadbox.db.base import Base
from breadbox.db.session import SessionWithUser, SessionLocalWithUser
from breadbox.config import Settings
from breadbox.startup import create_app
from breadbox.crud.access_control import PUBLIC_GROUP_ID, TRANSIENT_GROUP_ID
from breadbox.service.dataset import add_dimension_type
from breadbox.crud.data_type import add_data_type
from breadbox.crud.group import (
    add_group,
    add_group_entry,
)
from breadbox.schemas.group import GroupIn, GroupEntryIn
from breadbox.schemas.dataset import (
    AddDatasetResponse,
    MatrixDatasetParams,
    TableDatasetParams,
)
from breadbox.compute import dataset_tasks
from breadbox.compute import dataset_uploads_tasks
from fastapi import FastAPI, Request

from breadbox.compute import dataset_uploads_tasks
from breadbox.celery_task import utils

pytest_plugins = ("celery.contrib.pytest",)


@pytest.fixture()
def app(settings):
    yield create_app(settings)


@pytest.fixture(scope="function")
def db_path(tmpdir):
    return str(tmpdir.join("test.db"))


@pytest.fixture(scope="function")
def settings(tmpdir, db_path, monkeypatch):
    filestore_dir = str(tmpdir.join("dataset_files"))
    if not os.path.exists(filestore_dir):
        os.mkdir(filestore_dir)

    settings = Settings(
        sqlalchemy_database_url=f"sqlite:///{db_path}",
        filestore_location=filestore_dir,
        compute_results_location=str(tmpdir.join("results")),
        admin_users=["test-admin-user"],
        default_user="test@sample.com",
        breadbox_secret="secret",
        use_depmap_proxy=False,
    )

    import breadbox.config

    monkeypatch.setattr(breadbox.config, "_get_settings", lambda: settings)
    return settings


@pytest.fixture(scope="function")
def db(tmpdir, db_path, settings):
    db_url = f"sqlite:///{db_path}"

    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(
        autocommit=False, autoflush=False, bind=engine, class_=SessionWithUser
    )

    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    db.set_user(settings.admin_users[0])
    db.is_test_db_session = True
    yield db
    db.close()


# @pytest.fixture
# def enable_db_session_user_changes(monkeypatch):
#     def reset_user(self, user: str):
#         self._user = user
#         # caching should be turned off but just in case, clear the cache
#         self.read_group_ids = None
#     monkeypatch.setattr(SessionWithUser, "reset_user", reset_user)


@pytest.fixture(scope="function")
def client(db: SessionWithUser, settings: Settings, app: FastAPI):
    """
    An application for the tests
    Set tempfiles here so that they are different for every test
    Adds overrides to whatever config is passed in
    """

    def get_test_db_with_user(request: Request):
        user = get_user(request)
        db.reset_user(user)
        return db

    app.dependency_overrides[get_db_with_user] = get_test_db_with_user
    app.dependency_overrides[get_settings] = lambda: settings

    client = TestClient(app)

    return client


@pytest.fixture(scope="function")
def public_group(db: SessionWithUser, settings: Settings):
    # Make public group
    admin_user = settings.admin_users[0]
    public_group = add_group(db, admin_user, GroupIn(name="Public"), PUBLIC_GROUP_ID)
    add_group_entry(
        db,
        admin_user,
        public_group,
        GroupEntryIn(email="", exact_match=False, access_type="read"),
    )
    return public_group


@pytest.fixture(scope="function")
def transient_group(db: SessionWithUser, settings: Settings):
    # Make transient group
    admin_user = settings.admin_users[0]
    transient_group = add_group(
        db, admin_user, GroupIn(name="Transient datasets"), TRANSIENT_GROUP_ID
    )
    add_group_entry(
        db,
        admin_user,
        transient_group,
        GroupEntryIn(email="", exact_match=False, access_type="read"),
    )
    return transient_group


@pytest.fixture(scope="function")
def private_group(client: TestClient, settings: Settings):
    admin_user = settings.admin_users[0]
    headers = {"X-Forwarded-Email": admin_user}

    # Make private group
    r = client.post("/groups/", json={"name": "Private"}, headers=headers)
    assert r.status_code == 200
    private_group = r.json()

    r = client.post(
        f"/groups/{private_group['id']}/addAccess",
        json={
            "email": "@private-group.com",
            "access_type": "write",
            "exact_match": False,
        },
        headers=headers,
    )
    return private_group


@pytest.fixture(scope="function")
def minimal_db(db: SessionWithUser, settings: Settings, public_group, transient_group):
    "A database which has the public group and one feature type and one sample type defined"
    admin_user = settings.admin_users[0]
    add_dimension_type(
        db,
        settings,
        user=admin_user,
        name="generic",
        display_name="Generic",
        id_column="label",
        axis="feature",
    )
    add_dimension_type(
        db,
        settings,
        user=admin_user,
        name="depmap_model",
        display_name="Depmap Model",
        id_column="depmap_id",
        axis="sample",
    )
    add_data_type(db, "User upload")
    db.commit()
    db.flush()
    return db


@pytest.fixture(scope="session")
def celery_worker_pool():
    return "solo"


@pytest.fixture(scope="session")
def celery_includes():
    return ["breadbox.compute.analysis_tasks", "breadbox.compute.download_tasks"]


@pytest.fixture(scope="session")
def celery_config():
    return {
        "main": "compute",
        "broker_url": "memory://",
        "result_backend": "redis://",
        "task_always_eager": True,
    }


@pytest.fixture
def mock_celery(minimal_db, settings, monkeypatch, celery_app):
    @contextmanager
    def mock_db_context(user, commit=False):
        minimal_db.reset_user(user)
        yield minimal_db

    def get_test_settings():
        return settings

    def mock_check_celery():
        return True

    # Monkeypatch check_celery and pretend celery is running for test
    monkeypatch.setattr(utils, "check_celery", mock_check_celery)

    # The endpoint uses celery, and needs monkeypatching to replace db_context and get_settings,
    # which are not passed in as params due to the limits of redis serialization.
    monkeypatch.setattr(dataset_tasks, "db_context", mock_db_context)
    monkeypatch.setattr(dataset_tasks, "get_settings", get_test_settings)
    monkeypatch.setattr(
        dataset_tasks,
        "run_upload_dataset",
        celery_app.task(bind=True)(dataset_tasks.run_upload_dataset),
    )

    def mock_run_dataset_upload_task(dataset_params, user):
        if dataset_params["format"] == "matrix":
            params = MatrixDatasetParams(**dataset_params)
        else:
            params = TableDatasetParams(**dataset_params)
        minimal_db.reset_user(user)
        return dataset_uploads_tasks.dataset_upload(
            minimal_db, params, user, ProgressTracker()
        )

    def mock_return_task(result):
        from celery.result import EagerResult

        state = "SUCCESS"
        if isinstance(result, EagerResult):
            result = result.result

        if hasattr(result, "model_dump"):
            result_json = result.model_dump()
        elif isinstance(result, HTTPException):
            state = "FAILURE"
            result_json = {"detail": result.detail, "status_code": result.status_code}
        elif isinstance(result, AssertionError):
            state = "FAILURE"
            result_json = {"detail": result.args[0], "status_code": 500}
        else:
            raise NotImplementedError()

        return AddDatasetResponse(
            id="123",
            state=state,
            result=result_json,
            message=None,
            percentComplete=None,
        )

    monkeypatch.setattr(
        dataset_uploads_tasks.run_dataset_upload, "delay", mock_run_dataset_upload_task,
    )
    monkeypatch.setattr(utils, "format_task_status", mock_return_task)

    yield


# based on https://docs.pytest.org/en/latest/example/simple.html#control-skipping-of-tests-according-to-command-line-option
def pytest_addoption(parser):
    parser.addoption(
        "--runslow", action="store_true", default=False, help="run slow tests"
    )
    parser.addoption(
        "--skipcelery",
        action="store_true",
        default=False,
        help="Skip celery tests because they're kinda slow",
    )


def pytest_configure(config):
    config.addinivalue_line("markers", "slow: mark test as slow to run")


def pytest_collection_modifyitems(config, items):
    if config.getoption("--runslow"):
        # --runslow given in cli: do not skip slow tests
        pass
    else:
        skip_slow = pytest.mark.skip(reason="need --runslow option to run")
        for item in items:
            if "slow" in item.keywords:
                item.add_marker(skip_slow)
    if config.getoption("--skipcelery"):
        skip_celery = pytest.mark.skip(reason="--skipcelery was specified")
        for item in items:
            if "celery" in item.keywords:
                item.add_marker(skip_celery)
