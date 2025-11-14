from contextlib import contextmanager
import time
import resource
from logging import getLogger

log = getLogger(__name__)


def get_rss():
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024 ** 2  # in MB
    # psutil.Process(os.getpid()).memory_info().rss / 1024 ** 2 # in MB


_depth = 0


@contextmanager
def print_span_stats(name):
    global _depth

    log.warning(f"{'  '*_depth} start {name}")
    start_time = time.perf_counter()
    start_rss = get_rss()
    try:
        _depth += 1
        yield
    finally:
        _depth -= 1
        end_rss = get_rss()
        rss_delta = end_rss - start_rss
        end_time = time.perf_counter()
        log.warning(
            f"{'  '*_depth} end {name}: elapsed time: {end_time - start_time}, rss delta: {rss_delta} ({end_rss} - {start_rss})"
        )
