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
    # the goal of this function is to allow run a command in a different venv, where that venv is
    # managed by poetry. Naively one would think this should be achieved by running
    # `poetry run ...` but if the python code that is executing the `poetry run ...` command was
    # itself in a venv, poetry uses the *current* venv instead of the one based on the working directory.
    # To make things even more confusing, this is the behavior that I see on the github actions server
    # but not what I see when running locally, making this incredibly difficult to debug. While I cannot
    # explain the different between the behavior from poetry when running locally and that which I see on
    # the github server, I have determined that the way it tells if there is a "current" venv is by
    # looking at the VIRTUAL_ENV enviornment variable.
    #
    # If you delete that variable, then `poetry` calls will correctly identify the venv based on the
    # current working directory.
    #

    if env is None:
        env = dict(os.environ)

    if "VIRTUAL_ENV" in env:
        del env["VIRTUAL_ENV"]

    # ask for the path to the venv for the dir provided by the caller
    result = subprocess.run(["poetry", "env", "info", "--path"], cwd=dir, check=True, capture_output=True, text=True, env=env)
    venv_path = result.stdout.strip()

    # now that we know the venv, add it to the path. This is necessary because some commands call other
    # commands and they need to find them in the path. (ie: `bb recreate-dev-db` in turn runs `alembic`)
    path = env['PATH']
    env["PATH"] = f"{venv_path}/bin:{path}"

    # This is perhaps not necessary because the command should be possible to be found in the path
    # but I had intially done it when I was attempting to avoid manipulating the PATH variable.
    # In practice it's been helpful to see exactly which venv is being selected as the process
    # will now have the full path to the command.
    new_cmd = list(cmd)
    new_cmd[0] = f"{venv_path}/bin/{cmd[0]}"
    if check:
        subprocess.run(new_cmd, cwd=dir, env=env, check=True)
    else:
        return subprocess.Popen(new_cmd, cwd=dir, env=env)

# This fixture is a breadbox process running in the background which we can connect to.
#
# It takes a few seconds to startup breadbox, so create a single instance for all tests. This does mean
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
    "A breadbox client for testing"

    client = BBClient(base_url, user)

    # before returning the client, poll the breadbox service and make sure
    # it's accepting connections
    start = time.time()
    max_time = 40 # throw an error if it takes too long to get a connection
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

    # reaching here means we successfully were able to make a request and the breadbox service appears
    # to be up
    yield client
