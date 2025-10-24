import subprocess
import sys
import json
import re

# this script will run the command (passed as the command args) and then parse the json that it reads from
# stdout and emit a single line with the status which starts with either "completed" or "in-progress". This is all to make it easier for conseq to determine
# whether a job is running or not

# based on https://cloud.google.com/batch/docs/reference/rest/v1alpha/projects.locations.jobs#State
terminal_states = [
    "SUCCEEDED",
    "FAILED",
    "CANCELLED",
    "SCHEDULED_PENDING_FAILED",
    "RUNNING_PENDING_FAILED",
]
in_progress_state = [
    "QUEUED",
    "SCHEDULED",
    "RUNNING",
    "DELETION_IN_PROGRESS",
    "CANCELLATION_IN_PROGRESS",
]

command = sys.argv[1:]
stdout = subprocess.check_output(command)
try:
    status = json.loads(stdout)
    assert len(status) == 1
    status_message = status[0]["status-message"]
    if status_message is None:  # seems to happen right after job submission
        prefix = "IN_PROGRESS"
    else:
        m = re.match(
            "Job state is set from [A-Z_]+ to ([A-Z_]+) for job.*", status_message
        )
        assert m is not None
        state = m.group(1)
        if state in terminal_states:
            prefix = "COMPLETED"
        else:
            assert state in in_progress_state
            prefix = "IN_PROGRESS"
except Exception as ex:
    sys.stderr.write(f"got exception parsing output from command {command}: {stdout}")
    raise ex
with open("last_check_status.log", "wt") as fd:
    fd.write(f"command: {command}\n{stdout}")
print(f"{prefix}: {status_message}")
