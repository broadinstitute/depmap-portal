from contextlib import contextmanager
import time
import contextvars
from typing import List, Optional

_profile_stack: contextvars.ContextVar[Optional[List]] = contextvars.ContextVar(
    "profile_stack", default=None
)

PRINT_PROFILE = False

from dataclasses import dataclass
import resource
import sys


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
def profiled_region(msg):
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
