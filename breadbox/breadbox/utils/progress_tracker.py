from typing import List, Optional
import time

from celery import Task


class ProgressTracker:
    message: str
    progress_value: float
    progress_max_value: Optional[float]

    prev_emitted_message: str
    prev_emitted_timestamp: float

    task: Optional[Task]

    def __init__(self, *, task=None, delay_between_updates=5):
        self.message = "Started"
        self.progress_value = 0.0
        self.progress_max_value = None

        self.prev_emitted_message = ""
        self.prev_emitted_timestamp = time.time()
        self.delay_between_updates = delay_between_updates
        self.task = task

    def update_message(self, message: str):
        self.message = message
        self._emit_update(force=True)

    def update_progress(self, value: float):
        self.progress_value = value
        self._emit_update()

    def update_process_max_value(self, value):
        self.progress_value = 0
        self.progress_max_value = value
        self._emit_update(force=True)

    def _emit_update(self, force=True):
        message = self.message
        if self.progress_max_value is not None and self.progress_value is not None:
            message = f"{message} ({ int(self.progress_value/self.progress_max_value*100) }% complete)"
        if self.prev_emitted_message != message:
            if force or (
                (time.time() - self.prev_emitted_timestamp) > self.delay_between_updates
            ):
                print(message)

                update_state = {"message": message}

                if self.task is not None:
                    if not self.task.request.called_directly:
                        self.task.update_state(
                            state="PROGRESS", meta=update_state,
                        )

                self.last_update = time.time()
                self.prev_message = message
