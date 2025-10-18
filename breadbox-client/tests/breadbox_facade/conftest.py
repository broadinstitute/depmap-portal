import time
from typing import List, Optional, Dict

from pytest import fixture
import subprocess
import tempfile
import os
import httpx
from breadbox_facade import AXIS_SAMPLE, COL_TYPE_CONTINUOUS, COL_TYPE_TEXT, BBClient, ColumnMetadata
import socket

breadbox_test_instance_port = 8291
user = "admin"
base_url = f"http://localhost:{breadbox_test_instance_port}"

def _run_in_poetry_venv(dir : str, cmd : List[str], env:Optional[Dict[str,str]] = None, check: bool = False):
    if env is None:
        env = dict(os.environ)

    print("dumping env")
    for key, value in env.items():
        print(f"{key}={value}")

    print("poetry info")
    subprocess.run(["poetry", "-vvv", "env", "info"], cwd=dir)

    print('poetry config')
    subprocess.run(["poetry", "-vvv", "config", "--list"], cwd=dir)

    result = subprocess.run(["poetry", "env", "info", "--path"], cwd=dir, check=True, capture_output=True, text=True)
    venv_path = result.stdout.strip()
    print(f"venv path from running in {dir}: {venv_path}")

    path = env['PATH']
    env["PATH"] = f"{venv_path}/bin:{path}"

    new_cmd = list(cmd)
    new_cmd[0] = f"{venv_path}/bin/{cmd[0]}"
    if check:
        subprocess.run(new_cmd, cwd=dir, env=env, check=True)
    else:
        return subprocess.Popen(new_cmd, cwd=dir, env=env)

# This takes a few seconds to startup breadbox, so create a single instance for all tests. This does mean
# that tests will have to be more careful about not making assumptions about the state of the DB
# when they start. If it's too much a pain we can flip it to be scoped to per-function. It'll just make
# each test slower.
@fixture(scope="session")
def breadbox_proc():
    with tempfile.TemporaryDirectory() as tmpdir:
        try:
            connection = socket.create_connection( ("localhost", breadbox_test_instance_port) )
            connection.close()
            connected = True
        except ConnectionRefusedError:
            connected = False

        if connected:
            raise Exception(f"There appears to already be a process listening to {base_url}. Kill it before running tests (or change the value of breadbox_test_instance_port in conftest.py). To determine the process you can run: lsof -i tcp:{breadbox_test_instance_port}")

        os.makedirs(f"{tmpdir}/app_datasets/results")
        with open(f"{tmpdir}/settings", "wt") as f:
            f.write(f"""
    SQLALCHEMY_DATABASE_URL = "sqlite:///{tmpdir}/sql_app.db"
    FILESTORE_LOCATION = "{tmpdir}/app_datasets"
    ADMIN_USERS = ["dev@sample.com", "admin"]
    DEFAULT_USER = "dev@sample.com"
    USE_DEPMAP_PROXY = False
    COMPUTE_RESULTS_LOCATION = "{tmpdir}/app_datasets/results"
    BREADBOX_ENV = "dev"
    BREADBOX_SECRET = "secret"
    BROKERLESS_CELERY_FOR_TESTING = True
    """)

        new_env=dict(os.environ)
        new_env["PYTHONUNBUFFERED"] = "1"
        new_env.update({"BREADBOX_SETTINGS_PATH": f"{tmpdir}/settings"})

        cmd = ["bb-cmd", "recreate-dev-db"]
        _run_in_poetry_venv("../breadbox", cmd, env=new_env, check=True)

        cmd = ["bb-cmd", "run", "--no-reload", "--port", str(breadbox_test_instance_port)]
        proc = _run_in_poetry_venv("../breadbox", cmd, env=new_env)

        try:
            yield proc
        finally:
            proc.terminate()
            proc.wait(10)

@fixture
def breadbox_client(breadbox_proc: subprocess.Popen):
    client = BBClient(base_url, user)

    start = time.time()
    max_time = 40
    while True:
        response = None
        try:
            response = client.is_ok()
        except httpx.ConnectError:
            pass

        if response is not None:
            assert response.status_code == 200
            break

        elapsed = time.time() - start
        if elapsed > max_time:
            raise AssertionError("Breadbox did not respond in time")

        retcode = None
        try:
            retcode = breadbox_proc.wait(0)
        except subprocess.TimeoutExpired:
            pass

        if retcode is not None:
            # this means the process has died
            raise AssertionError(f"The command to start breadbox exited prematurely (retcode: {retcode}): {breadbox_proc}")

        time.sleep(0.1)

    # reaching here means we successfully were able to make a request
    yield client
