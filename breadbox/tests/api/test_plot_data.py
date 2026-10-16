"""
Tests for POST /plot-data against a fake child process (so they run everywhere, with no
node). The real script is exercised in test_plot_data_real_bundle.py.
"""
import asyncio
import json
import os
import sys
import textwrap
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, Optional, cast

import pytest
from fastapi import Request
from fastapi.testclient import TestClient

import breadbox.service.plot_data as plot_data_module
from breadbox.api.dependencies import get_user
from breadbox.api.temp.plot_data import run_until_disconnect
from breadbox.config import get_settings

FAKE_CHILD = textwrap.dedent(
    """
    import json, os, sys, time, signal

    raw = sys.stdin.read()
    req = json.loads(raw)
    cfg = req["plot_config"]
    mode = cfg.get("mode", "echo")

    def out(doc):
        sys.stdout.write(json.dumps(doc))
        sys.stdout.flush()

    pidfile = cfg.get("pidfile")
    if pidfile:
        with open(pidfile, "w") as f:
            f.write(str(os.getpid()))

    def wait_for(path):
        while not os.path.exists(path):
            time.sleep(0.02)

    if mode == "echo":
        out({"ok": True, "data": {
            "stdin": req,
            "stdin_keys": sorted(req),
            "env_keys": sorted(os.environ),
            "env_has_secret": "PLOT_DATA_TEST_SECRET" in os.environ,
            "stdin_bytes": len(raw),
        }})
    elif mode.startswith("err:"):
        out({"ok": False, "error": {"code": mode[4:], "message": "fake says " + mode[4:], "details": None}})
    elif mode == "exit1":
        sys.stderr.write("SECRET-STDERR-MARKER /home/someone/path Traceback\\n")
        sys.exit(1)
    elif mode == "empty":
        pass
    elif mode == "junk":
        sys.stdout.write("this is not json SECRET-STDERR-MARKER")
    elif mode == "two_docs":
        out({"ok": True, "data": {}}); out({"ok": True, "data": {}})
    elif mode == "data_not_object":
        out({"ok": True, "data": [1, 2]})
    elif mode == "big":
        sys.stdout.write('{"ok":true,"data":{"x":"' + "a" * cfg["size"] + '"}}')
        sys.stdout.flush()
    elif mode == "sleep":
        if cfg.get("ignore_sigterm"):
            signal.signal(signal.SIGTERM, signal.SIG_IGN)
        time.sleep(60)
    elif mode == "hold":
        wait_for(cfg["release"])
        out({"ok": True, "data": {"held": True}})
    elif mode == "chatty":
        for _ in range(cfg["lines"]):
            sys.stderr.write("x" * 1000 + "\\n")
        out({"ok": True, "data": {"done": True}})
    else:
        raise SystemExit("unknown mode " + mode)
    """
)


@pytest.fixture
def fake_child(tmp_path, settings):
    script = tmp_path / "fake_child.py"
    script.write_text(FAKE_CHILD)
    settings.plot_data_command_override = [sys.executable, str(script)]
    settings.plot_data_base_url = "http://127.0.0.1:12345"
    return script


@pytest.fixture
def plot_client(app, settings, fake_child):
    app.dependency_overrides[get_settings] = lambda: settings
    # a context manager keeps one event loop alive across requests, as in production
    with TestClient(app) as c:
        yield c


def service_of(app):
    return app.state.plot_data_service


def post(
    client, config: Dict[str, Any], user: Optional[str] = "alice@example.com", **kw
):
    headers = {"X-Forwarded-Email": user} if user else {}
    return client.post(
        "/temp/plot-data",
        json={"api_version": 1, "plot_config": config},
        headers=headers,
        **kw,
    )


def pid_is_gone(pid: int) -> bool:
    # a zombie (not reaped) still answers kill(pid, 0), so this checks reaping too
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return True
    return False


def wait_for_file(path, timeout=10.0) -> str:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if path.exists() and path.read_text():
            return path.read_text()
        time.sleep(0.02)
    raise AssertionError(f"{path} never appeared")


def wait_until(predicate, timeout=10.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return
        time.sleep(0.02)
    raise AssertionError("condition never became true")


# ---------------------------------------------------------------- success path


def test_success_envelope_headers_and_exact_stdin(plot_client, app, settings):
    config = {"plot_type": "scatter", "dimensions": {"x": {"k": [1, 2]}}}
    r = post(plot_client, config, user="alice@example.com")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/json"
    body = r.json()
    assert set(body) == {"api_version", "data"}
    assert body["api_version"] == 1

    stdin = body["data"]["stdin"]
    assert body["data"]["stdin_keys"] == ["api_version", "breadbox", "plot_config"]
    assert stdin["api_version"] == 1
    assert stdin["plot_config"] == config
    assert stdin["breadbox"] == {
        "base_url": settings.plot_data_base_url,
        # the resolved user and nothing else
        "headers": {"X-Forwarded-Email": "alice@example.com"},
    }

    assert r.headers["x-plot-data-bytes"] == str(len(r.content))
    timing = r.headers["server-timing"]
    assert "total;dur=" in timing and "node;dur=" in timing
    assert 'cache;desc="miss"' in timing


def test_only_the_resolved_user_is_forwarded(plot_client):
    # other headers on the incoming request must never reach the child
    r = plot_client.post(
        "/temp/plot-data",
        json={"api_version": 1, "plot_config": {}},
        headers={
            "X-Forwarded-Email": "alice@example.com",
            "X-Forwarded-User": "someone-else",
            "Authorization": "Bearer abc",
            "Cookie": "session=abc",
        },
    )
    assert r.status_code == 200
    raw = r.text
    assert (
        "Bearer" not in raw and "session=abc" not in raw and "someone-else" not in raw
    )
    assert r.json()["data"]["stdin"]["breadbox"]["headers"] == {
        "X-Forwarded-Email": "alice@example.com"
    }


def test_x_forwarded_user_is_passed_as_email_header(plot_client):
    r = plot_client.post(
        "/temp/plot-data",
        json={"api_version": 1, "plot_config": {}},
        headers={"X-Forwarded-User": "bob"},
    )
    assert r.json()["data"]["stdin"]["breadbox"]["headers"] == {
        "X-Forwarded-Email": "bob"
    }


def test_child_gets_a_minimal_environment(plot_client, monkeypatch):
    monkeypatch.setenv("PLOT_DATA_TEST_SECRET", "hunter2")
    data = post(plot_client, {}).json()["data"]
    assert data["env_has_secret"] is False
    assert "PATH" in data["env_keys"]
    # (the OS/interpreter may add a locale variable of its own)
    assert set(data["env_keys"]) <= {"PATH", "LC_CTYPE", "__CF_USER_TEXT_ENCODING"}


def test_env_passthrough_forwards_only_listed_names(plot_client, settings, monkeypatch):
    monkeypatch.setenv("PLOT_DATA_TEST_ALLOWED", "yes")
    monkeypatch.setenv("PLOT_DATA_TEST_SECRET", "hunter2")
    settings.plot_data_child_env_passthrough = [
        "PLOT_DATA_TEST_ALLOWED",
        "NOT_SET_ANYWHERE",
    ]
    data = post(plot_client, {}).json()["data"]
    assert "PLOT_DATA_TEST_ALLOWED" in data["env_keys"]
    assert "NOT_SET_ANYWHERE" not in data["env_keys"]
    assert data["env_has_secret"] is False


def test_large_request_and_stdin_do_not_deadlock(plot_client):
    # bigger than a pipe buffer, below the 256 KB cap
    config = {"blob": "z" * 200_000}
    r = post(plot_client, config)
    assert r.status_code == 200
    assert r.json()["data"]["stdin"]["plot_config"] == config


def test_chatty_stderr_does_not_deadlock(plot_client):
    r = post(plot_client, {"mode": "chatty", "lines": 5000})  # ~5 MB of stderr
    assert r.status_code == 200
    assert r.json()["data"] == {"done": True}


# ---------------------------------------------------------------------- errors


@pytest.mark.parametrize(
    "code,status",
    [
        ("invalid_config", 422),
        ("forbidden", 403),
        ("dataset_not_found", 404),
        ("upstream_error", 502),
    ],
)
def test_script_error_codes(plot_client, code, status):
    r = post(plot_client, {"mode": f"err:{code}"})
    assert r.status_code == status
    assert r.json() == {
        "error": {"code": code, "message": f"fake says {code}", "details": None}
    }


def test_unknown_script_error_code_is_internal_error(plot_client):
    r = post(plot_client, {"mode": "err:something_new"})
    assert r.status_code == 500
    assert r.json()["error"]["code"] == "internal_error"
    assert "something_new" not in r.text


@pytest.mark.parametrize(
    "mode", ["exit1", "empty", "junk", "two_docs", "data_not_object"]
)
def test_bad_child_output_is_internal_error(plot_client, mode):
    r = post(plot_client, {"mode": mode})
    assert r.status_code == 500
    body = r.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == "internal_error"
    assert body["error"]["details"] is None
    for leaked in ("SECRET-STDERR-MARKER", "/home/", "Traceback", sys.executable):
        assert leaked not in r.text


def test_missing_command_is_internal_error(plot_client, settings):
    settings.plot_data_command_override = ["/no/such/binary"]
    r = post(plot_client, {})
    assert r.status_code == 500
    assert r.json()["error"]["code"] == "internal_error"
    assert "/no/such" not in r.text


def test_missing_script_is_internal_error(plot_client, settings, monkeypatch, tmp_path):
    settings.plot_data_command_override = None
    monkeypatch.setattr(plot_data_module, "SCRIPT_PATH", tmp_path / "nope.js")
    r = post(plot_client, {})
    assert r.status_code == 500
    assert r.json()["error"]["code"] == "internal_error"
    assert "nope.js" not in r.text


def test_output_over_cap(plot_client, settings, tmp_path):
    settings.plot_data_max_output_bytes = 1_000_000
    pidfile = tmp_path / "pid"
    r = post(plot_client, {"mode": "big", "size": 5_000_000, "pidfile": str(pidfile)})
    assert r.status_code == 413
    err = r.json()["error"]
    assert err["code"] == "result_too_large"
    assert err["details"]["limit"] == 1_000_000
    assert err["details"]["bytes"] > 1_000_000
    assert pid_is_gone(int(pidfile.read_text()))


@pytest.mark.parametrize("ignore_sigterm", [False, True])
def test_deadline_kills_child(
    plot_client, settings, tmp_path, monkeypatch, ignore_sigterm
):
    settings.plot_data_timeout_seconds = 0.5
    monkeypatch.setattr(plot_data_module, "KILL_GRACE_SECONDS", 0.3)
    pidfile = tmp_path / "pid"
    t0 = time.time()
    r = post(
        plot_client,
        {"mode": "sleep", "pidfile": str(pidfile), "ignore_sigterm": ignore_sigterm},
    )
    assert r.status_code == 504
    assert r.json()["error"]["code"] == "timeout"
    assert time.time() - t0 < 10
    assert pid_is_gone(int(pidfile.read_text()))


# ----------------------------------------------------------- request validation


def raw_post(client, content: bytes, **kw):
    return client.post(
        "/temp/plot-data",
        content=content,
        headers={
            "X-Forwarded-Email": "a@b.c",
            "Content-Type": "application/json",
            **kw,
        },
    )


def assert_error(r, status, code):
    assert r.status_code == status, r.text
    body = r.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == code
    assert "detail" not in body
    return body["error"]


@pytest.mark.parametrize(
    "content",
    [
        b"not json",
        b"",
        b"[1, 2]",
        b'"string"',
        b'{"api_version": 1}',
        b'{"plot_config": {}}',
        b'{"api_version": "1", "plot_config": {}}',
        b'{"api_version": 1.5, "plot_config": {}}',
        b'{"api_version": true, "plot_config": {}}',
        b'{"api_version": 1, "plot_config": []}',
        b'{"api_version": 1, "plot_config": "x"}',
        b'{"api_version": 1, "plot_config": {"a": NaN}}',
    ],
)
def test_invalid_request(plot_client, content):
    r = raw_post(plot_client, content)
    assert_error(r, 400, "invalid_request")
    assert not hasattr(plot_client.app.state, "plot_data_service") or (
        service_of(plot_client.app).spawn_count == 0
    )


def test_unsupported_api_version(plot_client):
    r = plot_client.post(
        "/temp/plot-data",
        json={"api_version": 2, "plot_config": {}},
        headers={"X-Forwarded-Email": "a@b.c"},
    )
    err = assert_error(r, 400, "unsupported_api_version")
    assert err["details"] == {"supported": [1]}
    assert service_of(plot_client.app).spawn_count == 0


def test_body_over_256kb(plot_client):
    big = json.dumps({"api_version": 1, "plot_config": {"x": "y" * (256 * 1024)}})
    err = assert_error(raw_post(plot_client, big.encode()), 413, "request_too_large")
    assert err["details"] == {"limit": 256 * 1024}
    assert service_of(plot_client.app).spawn_count == 0


def test_body_over_cap_without_content_length(plot_client):
    # chunked bodies have no Content-Length to check up front
    def chunks():
        for _ in range(40):
            yield b" " * 10_000

    r = plot_client.post(
        "/temp/plot-data", content=chunks(), headers={"X-Forwarded-Email": "a@b.c"}
    )
    assert_error(r, 413, "request_too_large")


def test_other_routes_keep_their_error_shape(plot_client, settings):
    settings.breadbox_env = "prod"
    r = plot_client.get("/user/settings")  # no identity -> get_user's own 401
    assert r.status_code == 401
    assert r.json() == {"detail": "User cannot be null"}


# --------------------------------------------------------------------- identity


def test_no_identity_outside_dev_is_401_and_spawns_nothing(plot_client, settings):
    settings.breadbox_env = "prod"
    r = post(plot_client, {}, user=None)
    assert r.status_code == 401
    assert not hasattr(plot_client.app.state, "plot_data_service")


def test_dev_falls_back_to_default_user(plot_client, settings):
    settings.breadbox_env = "dev"
    r = post(plot_client, {}, user=None)
    assert r.status_code == 200
    assert r.json()["data"]["stdin"]["breadbox"]["headers"] == {
        "X-Forwarded-Email": settings.default_user
    }


def test_restricted_to_one_user_when_the_setting_is_set(plot_client, app, settings):
    settings.restrict_sql_endpoint_access_to_user = "depmap-mcp-server"
    r = post(plot_client, {}, user="someone@example.com")
    assert_error(r, 403, "forbidden")
    assert service_of(app).spawn_count == 0
    assert post(plot_client, {}, user="depmap-mcp-server").status_code == 200
    assert service_of(app).spawn_count == 1


def test_unrestricted_when_the_setting_is_none(plot_client, settings):
    settings.restrict_sql_endpoint_access_to_user = None
    assert post(plot_client, {}, user="anyone@example.com").status_code == 200


# ------------------------------------------------------------------------ cache


def cache_state(r) -> str:
    return r.headers["server-timing"].split('cache;desc="')[1].rstrip('"')


def test_cache_hit_does_not_spawn(plot_client, app):
    config = {"a": 1, "b": [1, 2]}
    r1 = post(plot_client, config)
    r2 = post(plot_client, {"b": [1, 2], "a": 1})  # key order must not matter
    assert (cache_state(r1), cache_state(r2)) == ("miss", "hit")
    assert r1.content == r2.content
    assert service_of(app).spawn_count == 1


def test_cache_is_per_user(plot_client, app):
    config = {"a": 1}
    ra = post(plot_client, config, user="alice@example.com")
    rb = post(plot_client, config, user="bob@example.com")
    assert cache_state(rb) == "miss"
    assert service_of(app).spawn_count == 2
    # each user got a child that ran as them
    assert (
        ra.json()["data"]["stdin"]["breadbox"]["headers"]["X-Forwarded-Email"]
        == "alice@example.com"
    )
    assert (
        rb.json()["data"]["stdin"]["breadbox"]["headers"]["X-Forwarded-Email"]
        == "bob@example.com"
    )
    # and a repeat is served to the right one
    ra2 = post(plot_client, config, user="alice@example.com")
    assert cache_state(ra2) == "hit"
    assert ra2.content == ra.content


def test_cache_different_config_misses(plot_client, app):
    post(plot_client, {"a": 1})
    r = post(plot_client, {"a": 2})
    assert cache_state(r) == "miss"
    assert service_of(app).spawn_count == 2


def test_cache_ttl_expiry(plot_client, app, monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(plot_data_module, "_monotonic", lambda: now[0])
    post(plot_client, {"a": 1})
    now[0] += 299
    assert cache_state(post(plot_client, {"a": 1})) == "hit"
    now[0] += 2
    assert cache_state(post(plot_client, {"a": 1})) == "miss"
    assert service_of(app).spawn_count == 2


def test_errors_are_not_cached(plot_client, app):
    for _ in range(2):
        assert post(plot_client, {"mode": "err:invalid_config"}).status_code == 422
    for _ in range(2):
        assert post(plot_client, {"mode": "exit1"}).status_code == 500
    assert service_of(app).spawn_count == 4


def test_cache_disabled(plot_client, app, settings):
    settings.plot_data_cache_max_bytes = 0
    post(plot_client, {"a": 1})
    assert cache_state(post(plot_client, {"a": 1})) == "miss"
    assert service_of(app).spawn_count == 2


def test_cache_is_byte_bounded(plot_client, app, settings):
    settings.plot_data_cache_max_bytes = (
        600  # room for a couple of the small echo bodies
    )
    for i in range(6):
        assert post(plot_client, {"i": i}).status_code == 200
    cache = service_of(app).cache
    assert 0 < len(cache) < 6
    assert cache.currsize <= 600


def test_body_larger_than_the_whole_cache_is_not_stored(plot_client, app, settings):
    settings.plot_data_cache_max_bytes = 100
    post(plot_client, {"a": 1})
    assert cache_state(post(plot_client, {"a": 1})) == "miss"
    assert service_of(app).spawn_count == 2


def test_identical_concurrent_calls_share_one_child(plot_client, app, tmp_path):
    release = tmp_path / "release"
    config = {"mode": "hold", "release": str(release), "pidfile": str(tmp_path / "pid")}
    with ThreadPoolExecutor(2) as pool:
        f1 = pool.submit(post, plot_client, config)
        wait_for_file(tmp_path / "pid")
        f2 = pool.submit(post, plot_client, config)
        wait_until(
            lambda: any(
                f.waiters == 2 for f in service_of(app).limiter._flights.values()
            )
        )
        release.write_text("go")
        r1, r2 = f1.result(10), f2.result(10)
    assert r1.status_code == r2.status_code == 200
    assert r1.content == r2.content
    assert sorted([cache_state(r1), cache_state(r2)]) == ["coalesced", "miss"]
    assert service_of(app).spawn_count == 1


# ------------------------------------------------------------------ concurrency


def hold_config(tmp_path, name, release):
    return {
        "mode": "hold",
        "release": str(release),
        "pidfile": str(tmp_path / f"pid-{name}"),
    }


def test_third_request_queues_behind_cap_of_two(plot_client, app, settings, tmp_path):
    settings.plot_data_max_concurrency = 2
    release = tmp_path / "release"
    with ThreadPoolExecutor(3) as pool:
        futures = [
            pool.submit(post, plot_client, hold_config(tmp_path, n, release))
            for n in ("1", "2")
        ]
        wait_for_file(tmp_path / "pid-1")
        wait_for_file(tmp_path / "pid-2")
        futures.append(
            pool.submit(post, plot_client, hold_config(tmp_path, "3", release))
        )
        wait_until(lambda: len(service_of(app).limiter._waiters) == 1)
        time.sleep(0.3)
        assert not (tmp_path / "pid-3").exists()  # still queued, not running
        assert service_of(app).spawn_count == 2
        release.write_text("go")
        assert [f.result(10).status_code for f in futures] == [200, 200, 200]
    assert service_of(app).limiter._active == 0 and not service_of(app).limiter._waiters


def test_queue_full_is_429(plot_client, app, settings, tmp_path):
    settings.plot_data_max_concurrency = 1
    settings.plot_data_max_queue = 1
    release = tmp_path / "release"
    with ThreadPoolExecutor(3) as pool:
        f1 = pool.submit(post, plot_client, hold_config(tmp_path, "1", release))
        wait_for_file(tmp_path / "pid-1")
        f2 = pool.submit(post, plot_client, hold_config(tmp_path, "2", release))
        wait_until(lambda: len(service_of(app).limiter._waiters) == 1)
        r3 = post(plot_client, hold_config(tmp_path, "3", release))
        assert_error(r3, 429, "busy")
        assert int(r3.headers["retry-after"]) >= 1
        release.write_text("go")
        assert f1.result(10).status_code == 200
        assert f2.result(10).status_code == 200


def test_waiting_too_long_is_429(plot_client, app, settings, tmp_path):
    settings.plot_data_max_concurrency = 1
    settings.plot_data_queue_timeout_seconds = 0.3
    release = tmp_path / "release"
    with ThreadPoolExecutor(1) as pool:
        f1 = pool.submit(post, plot_client, hold_config(tmp_path, "1", release))
        wait_for_file(tmp_path / "pid-1")
        r2 = post(plot_client, hold_config(tmp_path, "2", release))
        assert_error(r2, 429, "busy")
        assert "retry-after" in r2.headers
        release.write_text("go")
        assert f1.result(10).status_code == 200
    assert service_of(app).limiter._active == 0 and not service_of(app).limiter._waiters


# ------------------------------------------------- cancellation / disconnecting


def run_service_cancelled(settings, tmp_path, cancel_after_pid=True):
    """Starts a call, cancels it once the child is running; returns the child's pid."""
    service = plot_data_module.PlotDataService(settings)
    pidfile = tmp_path / "pid"

    async def main() -> int:
        task = asyncio.ensure_future(
            service.run("u@x.y", {"mode": "sleep", "pidfile": str(pidfile)}, 1)
        )
        for _ in range(500):
            if pidfile.exists() and pidfile.read_text():
                break
            await asyncio.sleep(0.02)
        pid = int(pidfile.read_text())
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        return pid

    pid = asyncio.run(main())
    assert service.limiter._active == 0 and not service.limiter._flights
    return pid


def test_cancelling_a_call_kills_the_child(settings, fake_child, tmp_path):
    assert pid_is_gone(run_service_cancelled(settings, tmp_path))


def test_cancelled_waiter_does_not_cancel_the_shared_run(
    settings, fake_child, tmp_path
):
    service = plot_data_module.PlotDataService(settings)
    release = tmp_path / "release"
    config = {"mode": "hold", "release": str(release), "pidfile": str(tmp_path / "pid")}

    async def main():
        t1 = asyncio.ensure_future(service.run("u@x.y", config, 1))
        t2 = asyncio.ensure_future(service.run("u@x.y", config, 1))
        while not (tmp_path / "pid").exists() or not (tmp_path / "pid").read_text():
            await asyncio.sleep(0.02)
        await asyncio.sleep(0.1)
        t1.cancel()
        await asyncio.gather(t1, return_exceptions=True)
        release.write_text("go")
        return await t2

    result = asyncio.run(main())
    assert json.loads(result.body)["data"] == {"held": True}
    assert service.spawn_count == 1


def test_run_until_disconnect_cancels_work():
    class FakeRequest:
        calls = 0

        async def is_disconnected(self):
            self.calls += 1
            return self.calls > 2

    state = {"cancelled": False}

    async def slow():
        try:
            await asyncio.sleep(30)
        except asyncio.CancelledError:
            state["cancelled"] = True
            raise

    async def fast():
        return 7

    async def main():
        gone = await run_until_disconnect(
            cast(Request, FakeRequest()), slow(), poll_seconds=0.01
        )
        done = await run_until_disconnect(
            cast(Request, FakeRequest()), fast(), poll_seconds=0.01
        )
        return gone, done

    assert asyncio.run(main()) == (None, 7)
    assert state["cancelled"]


def test_get_user_is_the_dependency_in_use(app):
    # guards against someone re-implementing identity inside the route
    route = next(r for r in app.routes if getattr(r, "path", "") == "/temp/plot-data")
    assert get_user in [d.call for d in route.dependant.dependencies]


def test_route_is_not_in_the_openapi_schema(app):
    assert not any("plot-data" in path for path in app.openapi()["paths"])
