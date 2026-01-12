from contextlib import contextmanager
import time
import contextvars

profile_depth = contextvars.ContextVar("profile_depth", default=1)

PRINT_PROFILE = False


@contextmanager
def profiled_region(msg):
    if not PRINT_PROFILE:
        yield
        return

    orig_depth = profile_depth.get()
    profile_depth.set(orig_depth + 1)
    start = time.perf_counter()
    yield
    elapsed = time.perf_counter() - start
    print(f"{'>>>' * orig_depth} {msg}: {elapsed:.3} secs elapsed")
    profile_depth.set(orig_depth + 1)
