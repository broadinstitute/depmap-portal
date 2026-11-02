"""
POST /temp/plot-data on a real socket (uvicorn in a thread, seeded test database).

 - the client-disconnect test uses a fake child, so it runs everywhere;
 - the real-bundle tests run the actual plot-data.js against this same server, and are
   skipped without `node` or the built bundle. To run them locally, build it first:
       cd frontend && yarn build:embed
"""
import json
import os
import shutil
import socket
import sys
import threading
import time

import httpx
from fastapi import Request
import pytest
import uvicorn
from sqlalchemy.orm import sessionmaker

from breadbox.api.dependencies import get_db_with_user, get_user
from breadbox.config import get_settings
from breadbox.crud.group import add_group, add_group_entry
from breadbox.db.session import SessionWithUser
from breadbox.schemas.group import AccessType, GroupEntryIn, GroupIn
from breadbox.service.plot_data import SCRIPT_PATH
from tests import factories
from tests.api.test_plot_data import FAKE_CHILD, pid_is_gone, wait_for_file

needs_real_bundle = pytest.mark.skipif(
    shutil.which("node") is None or not SCRIPT_PATH.is_file(),
    reason="needs `node` on PATH and the built bundle "
    f"({SCRIPT_PATH}); run `yarn build:embed` in frontend/",
)

PRIVATE_USER = "member@private-group.com"
OUTSIDER = "outsider@example.com"


@pytest.fixture
def live_server(app, db, settings, minimal_db):
    """The app served on a real port, with each request on its own DB session."""
    maker = sessionmaker(
        autocommit=False, autoflush=False, bind=db.get_bind(), class_=SessionWithUser
    )

    def db_per_request(request: Request):
        user = get_user(request)
        session = maker()
        session.set_user(user, maker)
        session.is_test_db_session = False
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db_with_user] = db_per_request
    app.dependency_overrides[get_settings] = lambda: settings

    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    settings.plot_data_base_url = f"http://127.0.0.1:{port}"

    server = uvicorn.Server(
        uvicorn.Config(
            app, host="127.0.0.1", port=port, log_level="warning", lifespan="off"
        )
    )
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.time() + 10
    while not server.started:
        assert time.time() < deadline, "uvicorn did not start"
        time.sleep(0.02)
    yield settings.plot_data_base_url
    server.should_exit = True
    thread.join(10)


def density_config(dataset_id, sample="ACH-1"):
    # One sample's values across the dataset's features. (Indexing by feature avoids the
    # depmap_model_metadata lookups the page makes for hover tips on sample-indexed plots.)
    return {
        "plot_type": "density_1d",
        "index_type": "generic",
        "dimensions": {
            "x": {
                "axis_type": "raw_slice",
                "aggregation": "first",
                "dataset_id": dataset_id,
                "slice_type": "depmap_model",
                "context": {
                    "name": sample,
                    "dimension_type": "depmap_model",
                    "expr": {"==": [{"var": "given_id"}, sample]},
                    "vars": {},
                },
            }
        },
    }


def call(base_url, config, user, timeout=60):
    return httpx.post(
        f"{base_url}/temp/plot-data",
        json={"api_version": 1, "plot_config": config},
        headers={"X-Forwarded-Email": user},
        timeout=timeout,
    )


def test_client_disconnect_kills_child(live_server, settings, tmp_path):
    script = tmp_path / "fake_child.py"
    script.write_text(FAKE_CHILD)
    settings.plot_data_command_override = [sys.executable, str(script)]
    pidfile = tmp_path / "pid"
    body = json.dumps(
        {"api_version": 1, "plot_config": {"mode": "sleep", "pidfile": str(pidfile)}}
    )

    host_port = live_server.split("//")[1]
    host, port = host_port.split(":")
    sock = socket.create_connection((host, int(port)))
    sock.sendall(
        (
            "POST /temp/plot-data HTTP/1.1\r\n"
            f"Host: {host_port}\r\nContent-Type: application/json\r\n"
            "X-Forwarded-Email: a@b.c\r\n"
            f"Content-Length: {len(body)}\r\n\r\n{body}"
        ).encode()
    )
    pid = int(wait_for_file(pidfile))
    assert not pid_is_gone(pid)
    sock.close()  # the client walks away
    deadline = time.time() + 15
    while not pid_is_gone(pid):
        assert time.time() < deadline, "child outlived its client"
        time.sleep(0.1)


@pytest.fixture
def datasets(db, settings, minimal_db):
    admin = settings.admin_users[0]
    private = add_group(db, admin, GroupIn(name="Private"))
    add_group_entry(
        db,
        admin,
        private,
        GroupEntryIn(
            email="@private-group.com", exact_match=False, access_type=AccessType.read
        ),
    )
    public_ds = factories.matrix_dataset(minimal_db, settings)
    private_ds = factories.matrix_dataset(minimal_db, settings, group=private.id)
    db.commit()
    return public_ds.id, private_ds.id


@needs_real_bundle
def test_real_script_returns_plot_data(live_server, datasets):
    public_id, _ = datasets
    r = call(live_server, density_config(public_id), OUTSIDER)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["api_version"] == 1
    assert isinstance(body["data"], dict) and body["data"]
    assert "Server-Timing" in r.headers


@needs_real_bundle
def test_real_script_reads_as_the_caller(live_server, datasets):
    _, private_id = datasets
    # a member of the private group sees it ...
    assert (
        call(live_server, density_config(private_id), PRIVATE_USER).status_code == 200
    )
    # ... and anyone else gets "not found", not data (and not a cached copy of the member's)
    r = call(live_server, density_config(private_id), OUTSIDER)
    assert r.status_code == 404, r.text
    assert r.json()["error"]["code"] == "dataset_not_found"
    assert "data" not in r.json()


@needs_real_bundle
def test_real_script_unknown_plot_type(live_server, datasets):
    public_id, _ = datasets
    config = density_config(public_id)
    config["plot_type"] = "pie_chart"
    r = call(live_server, config, OUTSIDER)
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_config"
