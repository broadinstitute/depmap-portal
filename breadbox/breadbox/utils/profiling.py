from contextlib import contextmanager
import time
import contextvars
from typing import List, Optional
from breadbox.config import get_settings
from dataclasses import dataclass
import resource
import sys
import logging
import os
import pickle
from typing import Callable, Generator

_profile_stack: contextvars.ContextVar[Optional[List]] = contextvars.ContextVar(
    "profile_stack", default=None
)

# control with env variable
PRINT_PROFILE = os.environ.get("PRINT_PROFILE", "") == "1"

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Span:
    message: str
    elapsed: float
    children: List
    prev_max_rss: int
    delta_max_rss: int


def print_log(msg):
    sys.stderr.write(msg + "\n")
    sys.stderr.flush()


def print_profile_span(span: Span, depth=0):
    print_log(
        f"{'   ' * depth} {span.message}: start_max_rss: {span.prev_max_rss}, max_rss delta: {span.delta_max_rss} {span.elapsed:.3} secs elapsed"
    )
    for child in span.children:
        print_profile_span(child, depth + 1)


def get_max_rss():
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss


@contextmanager
def profiled_region(msg: str):
    if not PRINT_PROFILE:
        yield
        return

    cur_child_spans = _profile_stack.get()
    if cur_child_spans is None:
        print_log(f"Entering new profiled region: {msg}")

    start = time.perf_counter()

    child_spans = []
    _profile_stack.set(child_spans)
    start_max_rss = get_max_rss()

    # suspend and run code inside "with" block
    yield

    elapsed = time.perf_counter() - start
    span = Span(msg, elapsed, child_spans, start_max_rss, get_max_rss() - start_max_rss)

    if cur_child_spans is not None:
        cur_child_spans.append(span)
    else:
        print_log(f"Profiled span stats:")
        print_profile_span(span)

    _profile_stack.set(cur_child_spans)


def dump_to_disk(dest_name, **vars):
    settings = get_settings()

    full_dest_name = os.path.join(settings.compute_results_location, "dump", dest_name)
    os.makedirs(os.path.dirname(full_dest_name), exist_ok=True)
    log.warning(f"Dumping {list(vars)} to {full_dest_name}")
    with open(full_dest_name, "wb") as f:
        pickle.dump(vars, f)
    log.warning("Done")


@contextmanager
def warn_if_slow(
    request: str, msg_builder: Callable[[], str], max_duration_seconds: float = 5
):
    """
    prints the message returned by `msg_builder` if the body of the `with` block takes more than `max_duration_seconds`
    """
    start = time.perf_counter()
    try:
        yield
    finally:
        duration = time.perf_counter() - start
        if duration > max_duration_seconds:
            try:
                log.warning("%s took %.2fs: %s", request, duration, msg_builder())
            except Exception:
                # don't let a bad msg_builder cause request to fail. Just log and move on
                log.exception("Got exception trying to generate msg for _warn_if_slow")
