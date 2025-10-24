import os
import datetime
import uuid

import psutil
import json
import contextlib


def _get_log_filename():
    return os.environ.get("DEBUG_EVENT_LOG")


@contextlib.contextmanager
def record_span(name):
    filename = _get_log_filename()
    if filename:
        op_id = str(uuid.uuid4())
        log_event(filename, "start", name, op_id)
        try:
            yield
        except:
            log_event(filename, "exception", name, op_id)
            raise
        log_event(filename, "end", name, op_id)
    else:
        yield


def log_event(filename, phase, name, op_id, context=None):
    process = psutil.Process(os.getpid())
    rss = process.memory_info().rss
    with open(filename, "a") as f:
        record = {
            "p": phase,
            "n": name,
            "id": op_id,
            "t": datetime.datetime.now().isoformat(timespec="seconds"),
            "m": rss,
        }
        if context:
            record.update(context)
        f.write(json.dumps(record) + "\n")
