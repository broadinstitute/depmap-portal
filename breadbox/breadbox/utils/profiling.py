from contextlib import contextmanager
import time
import contextvars

from breadbox.config import get_settings

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


import logging
import os
import pickle

log = logging.getLogger(__name__)


def dump_to_disk(dest_name, **vars):
    settings = get_settings()

    full_dest_name = os.path.join(settings.compute_results_location, "dump", dest_name)
    os.makedirs(os.path.dirname(full_dest_name), exist_ok=True)
    log.warning(f"Dumping {list(vars)} to {full_dest_name}")
    with open(full_dest_name, "wb") as f:
        pickle.dump(vars, f)
    log.warning("Done")
