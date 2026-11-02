"""
Runs the standalone Data Explorer plot-data script (see ADR 0010 in
frontend/packages/@depmap/data-explorer-2/docs/adr) as a child process on behalf of
POST /plot-data.

The pieces, from the outside in:

  PlotDataService.run       cache key, identity payload, one log line per call
  CoalescingLimiter.run     concurrency cap + queue, single-flight, cache (coalescing_limiter.py)
  run_plot_data_script      spawn, communicate() under the deadline, ALWAYS reap
  interpret_output          the script's stdout -> response body, or a PlotDataError

Nothing in here touches HTTP, so it can be tested without a client.
"""
import asyncio
import hashlib
import json
import logging
import os
import pathlib
import shutil
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from cachetools import TTLCache

from breadbox.config import Settings
from breadbox.service.coalescing_limiter import Busy, CoalescingLimiter, Timing
from breadbox.utils.strict_json import loads_strict

log = logging.getLogger(__name__)

SUPPORTED_API_VERSIONS = frozenset({1})

# <breadbox package>/static/plot-data/plot-data.js. Located relative to this file, never
# the working directory. (static/ is gitignored build output: `yarn build:embed`.)
SCRIPT_PATH = (
    pathlib.Path(__file__).resolve().parent.parent
    / "static"
    / "plot-data"
    / "plot-data.js"
)

STDERR_TAIL_BYTES = 16 * 1024
# How long a child gets between SIGTERM and SIGKILL. (Module level so tests can shorten it.)
KILL_GRACE_SECONDS = 2.0
MAX_MESSAGE_CHARS = 500

# Where the script's `ok: false` codes land. Anything else is a bug and is a 500.
_SCRIPT_ERROR_STATUS = {
    "invalid_config": 422,
    "forbidden": 403,
    "dataset_not_found": 404,
    "upstream_error": 502,
}
_DEFAULT_MESSAGES = {
    "invalid_config": "The plot configuration is not valid.",
    "forbidden": "You don't have permission to read the data this plot needs.",
    "dataset_not_found": "A dataset this plot needs was not found, or you don't have access to it.",
    "upstream_error": "Breadbox could not be reached or did not return a usable answer.",
}

_monotonic = time.monotonic


class PlotDataError(Exception):
    """
    An error with a known place in the endpoint's one error shape. `message` and
    `details` go to the client; `log_detail` (e.g. a stderr tail) never does.
    """

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        log_detail: Optional[str] = None,
    ):
        super().__init__(f"{code}: {message}")
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details
        self.headers = headers
        self.log_detail = log_detail


def internal_error(log_detail: str) -> PlotDataError:
    return PlotDataError(
        500,
        "internal_error",
        "Something went wrong while building the plot data.",
        log_detail=log_detail,
    )


@dataclass
class CallResult:
    body: bytes  # the complete, serialized 200 response body
    cache: str  # "hit" | "miss" | "coalesced"
    timing: Timing


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


_build_id_cache: Dict[Tuple[str, int, int], str] = {}


def _script_build_id(path: pathlib.Path) -> str:
    """A hash of the script's contents (recomputed only if mtime/size change)."""
    st = path.stat()
    key = (str(path), st.st_mtime_ns, st.st_size)
    build_id = _build_id_cache.get(key)
    if build_id is None:
        build_id = hashlib.sha256(path.read_bytes()).hexdigest()
        _build_id_cache.clear()
        _build_id_cache[key] = build_id
    return build_id


async def _reap(proc: "asyncio.subprocess.Process") -> None:
    """SIGTERM, then SIGKILL after a grace period; always waits for the exit."""
    if proc.returncode is not None:
        return
    try:
        proc.terminate()
    except ProcessLookupError:
        pass
    try:
        await asyncio.wait_for(proc.wait(), KILL_GRACE_SECONDS)
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except ProcessLookupError:
            pass
        await proc.wait()


async def _shielded(coro) -> None:
    """Runs coro to completion even if the caller is cancelled meanwhile."""
    task = asyncio.ensure_future(coro)
    cancelled = False
    while not task.done():
        try:
            await asyncio.shield(task)
        except asyncio.CancelledError:
            cancelled = True
    task.result()
    if cancelled:
        raise asyncio.CancelledError()


async def run_plot_data_script(
    cmd: List[str], payload: bytes, settings: Settings
) -> Tuple[int, bytes, bytes]:
    """Runs the child once; returns (exit code, stdout, stderr). Always reaps it."""
    # Minimal environment: Breadbox's own env may hold secrets the child must not see,
    # so only PATH and whatever is explicitly listed in settings gets through.
    env = {"PATH": os.environ.get("PATH", "")}
    for name in settings.plot_data_child_env_passthrough:
        if name in os.environ:
            env[name] = os.environ[name]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
    except OSError as e:
        log.error("plot-data: could not start %s: %s", cmd[0], e)
        raise internal_error(f"could not start child: {e}")

    try:
        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(payload), settings.plot_data_timeout_seconds
            )
        except asyncio.TimeoutError:
            raise PlotDataError(504, "timeout", "Building the plot data took too long.")
    finally:
        # Kill + wait no matter what: success, timeout, error or cancellation.
        await _shielded(_reap(proc))
    assert proc.returncode is not None
    return proc.returncode, stdout, stderr


def _tail_text(stderr: bytes) -> str:
    return stderr[-STDERR_TAIL_BYTES:].decode("utf-8", errors="replace")


def interpret_output(
    returncode: int, stdout: bytes, stderr: bytes, settings: Settings
) -> bytes:
    """The child's whole output -> the 200 response body, or a PlotDataError."""
    tail = _tail_text(stderr)
    if returncode != 0:
        raise internal_error(f"child exited with status {returncode}\n{tail}")
    limit = settings.plot_data_max_output_bytes
    if len(stdout) > limit:
        raise PlotDataError(
            413,
            "result_too_large",
            "The plot data is too large to return.",
            details={"bytes": len(stdout), "limit": limit},
        )
    text = stdout.strip()
    if not text:
        raise internal_error(f"child wrote nothing to stdout\n{tail}")
    try:
        # a second document after the first makes this fail with "Extra data"
        doc = loads_strict(text)
    except (ValueError, RecursionError) as e:
        raise internal_error(
            f"child stdout was not exactly one JSON document: {e}\n{tail}"
        )
    if not isinstance(doc, dict) or not isinstance(doc.get("ok"), bool):
        raise internal_error(f"child stdout had an unexpected shape\n{tail}")

    if doc["ok"]:
        data = doc.get("data")
        if not isinstance(data, dict):
            raise internal_error(f"child's `data` was not an object\n{tail}")
        body = json.dumps(
            {"api_version": 1, "data": data}, separators=(",", ":"), allow_nan=False
        ).encode("utf-8")
        if len(body) > limit:
            raise PlotDataError(
                413,
                "result_too_large",
                "The plot data is too large to return.",
                details={"bytes": len(body), "limit": limit},
            )
        return body

    error = doc.get("error")
    code = error.get("code") if isinstance(error, dict) else None
    if not isinstance(code, str) or code not in _SCRIPT_ERROR_STATUS:
        raise internal_error(f"child reported an unknown error code {code!r}\n{tail}")
    message = error.get("message")  # type: ignore[union-attr]
    if not isinstance(message, str) or not message.strip():
        message = _DEFAULT_MESSAGES[code]
    raise PlotDataError(_SCRIPT_ERROR_STATUS[code], code, message[:MAX_MESSAGE_CHARS])


class PlotDataService:
    def __init__(self, settings: Settings):
        self._settings = settings
        # Finished response bodies, bounded by total bytes (getsizeof=len) with a TTL.
        # None when disabled.
        self.cache: Optional["TTLCache[str, bytes]"] = None
        if (
            settings.plot_data_cache_max_bytes > 0
            and settings.plot_data_cache_ttl_seconds > 0
        ):
            self.cache = TTLCache(
                maxsize=settings.plot_data_cache_max_bytes,
                ttl=settings.plot_data_cache_ttl_seconds,
                getsizeof=len,
                timer=lambda: _monotonic(),
            )
        self.limiter = CoalescingLimiter(
            max_concurrency=settings.plot_data_max_concurrency,
            max_queue=settings.plot_data_max_queue,
            queue_timeout_seconds=settings.plot_data_queue_timeout_seconds,
            cache=self.cache,
        )
        self.spawn_count = 0  # children started; for tests and diagnostics

    async def run(
        self, user: str, plot_config: Dict[str, Any], api_version: int
    ) -> CallResult:
        started = _monotonic()
        cache_state = "miss"
        timing = Timing()

        def observe(state: str, t: Timing) -> None:
            nonlocal cache_state, timing
            cache_state, timing = state, t

        try:
            cmd, build_id = self._command_and_build_id()
            key = self._cache_key(plot_config, api_version, user, build_id)
            payload = self._payload(user, plot_config, api_version)

            async def compute(t: Timing) -> bytes:
                self.spawn_count += 1
                child_started = _monotonic()
                try:
                    code, stdout, stderr = await run_plot_data_script(
                        cmd, payload, self._settings
                    )
                finally:
                    t.node_ms = (_monotonic() - child_started) * 1000
                return interpret_output(code, stdout, stderr, self._settings)

            try:
                body, cache_state, timing = await self.limiter.run(
                    key, compute, observe
                )
            except Busy:
                raise self._busy() from None
        except PlotDataError as e:
            self._log(
                user,
                plot_config,
                api_version,
                cache_state,
                started,
                timing,
                0,
                e.code,
                e.log_detail,
            )
            raise
        except asyncio.CancelledError:
            self._log(
                user,
                plot_config,
                api_version,
                cache_state,
                started,
                timing,
                0,
                "cancelled",
                None,
            )
            raise
        self._log(
            user,
            plot_config,
            api_version,
            cache_state,
            started,
            timing,
            len(body),
            "ok",
            None,
        )
        return CallResult(body, cache_state, timing)

    @staticmethod
    def _cache_key(
        plot_config: Dict[str, Any], api_version: int, user: str, build_id: str
    ) -> str:
        # The user is part of the key: the same config yields different data (or a 404)
        # for different users. NUL separators keep the fields from running together.
        h = hashlib.sha256()
        for part in (canonical_json(plot_config), str(api_version), user, build_id):
            h.update(part.encode("utf-8"))
            h.update(b"\0")
        return h.hexdigest()

    def _payload(
        self, user: str, plot_config: Dict[str, Any], api_version: int
    ) -> bytes:
        # Credentials go on stdin only. The one header is how the child reads as `user`:
        # loopback requests bypass oauth2_proxy, so nothing else would identify them.
        return json.dumps(
            {
                "api_version": api_version,
                "plot_config": plot_config,
                "breadbox": {
                    "base_url": self._settings.plot_data_base_url,
                    "headers": {"X-Forwarded-Email": user},
                },
            },
            allow_nan=False,
        ).encode("utf-8")

    def _command_and_build_id(self) -> Tuple[List[str], str]:
        s = self._settings
        if s.plot_data_command_override:
            cmd = list(s.plot_data_command_override)
            return cmd, hashlib.sha256("\0".join(cmd).encode()).hexdigest()

        if not SCRIPT_PATH.is_file():
            log.error(
                "plot-data: %s is missing; the frontend bundle was not built into this "
                "image (run `yarn build:embed`)",
                SCRIPT_PATH,
            )
            raise internal_error("plot-data.js is missing")
        node = shutil.which("node")
        if node is None:
            log.error("plot-data: `node` was not found on PATH")
            raise internal_error("node is not installed")
        cmd = [
            node,
            f"--max-old-space-size={s.plot_data_node_max_old_space_mb}",
            str(SCRIPT_PATH),
        ]
        return cmd, _script_build_id(SCRIPT_PATH)

    def _busy(self) -> PlotDataError:
        retry_after = max(1, int(round(self._settings.plot_data_queue_timeout_seconds)))
        return PlotDataError(
            429,
            "busy",
            "The server is busy building other plots. Please try again shortly.",
            headers={"Retry-After": str(retry_after)},
        )

    # ------------------------------------------------------------ observability

    def _log(
        self,
        user: str,
        plot_config: Dict[str, Any],
        api_version: int,
        cache: str,
        started: float,
        timing: Timing,
        nbytes: int,
        outcome: str,
        stderr_detail: Optional[str],
    ) -> None:
        plot_type = plot_config.get("plot_type")
        if not isinstance(plot_type, str):
            plot_type = "-"
        total_ms = (_monotonic() - started) * 1000
        line = (
            "plot-data user=%s plot_type=%s api_version=%s cache=%s total_ms=%d "
            "queue_ms=%d node_ms=%d bytes=%d outcome=%s"
        )
        args = (
            user,
            plot_type[:64],
            api_version,
            cache,
            total_ms,
            timing.queue_ms,
            timing.node_ms,
            nbytes,
            outcome,
        )
        if outcome in ("internal_error", "timeout") and stderr_detail:
            log.error(line + "\nchild stderr tail:\n%s", *args, stderr_detail)
        elif outcome == "ok" or outcome == "cancelled":
            log.info(line, *args)
        else:
            log.warning(line, *args)
