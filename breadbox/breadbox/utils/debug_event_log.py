import os
import datetime

import psutil
import json


def _get_log_filename():
    return os.environ.get("DEBUG_EVENT_LOG")

def log_event(filename, phase, op_id, context=None):
    process = psutil.Process(os.getpid())
    rss = process.memory_info().rss
    with open(filename, "a") as f:
        record = {
            "p": phase,
            "id": op_id,
            "t": datetime.datetime.now().isoformat(timespec="seconds"),
            "m": rss,
        }
        if context:
            record.update(context)
        f.write(json.dumps(record) + "\n")
