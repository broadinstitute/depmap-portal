from typing import List, Optional
import time


class ProgressTracker:
    message: str
    progress_value: float
    progress_max_value: Optional[float]

    prev_emitted_message: str
    prev_emitted_timestamp: float

    def __init__(self, delay_between_updates=5):
        self.message = "Started"
        self.progress_value = 0.0
        self.progress_max_value = None

        self.prev_emitted_message = ""
        self.prev_emitted_timestamp = time.time()
        self.delay_between_updates = delay_between_updates

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
        # I'm adding this tracker to be able to send updates back to the client incrementally
        # but for the moment, this just prints status which will go into a log file
        message = self.message
        if self.progress_max_value is not None and self.progress_value is not None:
            message = f"{message} ({ int(self.progress_value/self.progress_max_value*100) }% complete)"
        if self.prev_emitted_message != message:
            if force or (
                (time.time() - self.prev_emitted_timestamp) > self.delay_between_updates
            ):
                print(message)
                self.last_update = time.time()
                self.prev_message = message
