from contextlib import contextmanager
import time
import resource
from logging import getLogger

log = getLogger(__name__)


def get_rss():
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024 ** 2  # in MB
    # psutil.Process(os.getpid()).memory_info().rss / 1024 ** 2 # in MB


@contextmanager
def print_span_stats(name):
    start_time = time.perf_counter()
    start_rss = get_rss()
    try:
        yield
    finally:
        end_rss = get_rss()
        rss_delta = end_rss - start_rss
        end_time = time.perf_counter()
        log.debug(
            f"span {name}: elapsed time: {end_time - start_time}, rss delta: {rss_delta} ({end_rss} - {start_rss})"
        )
