from .celery import app, LogErrorsTask
from ..db.util import db_context
from ..service import sql
import logging

log = logging.getLogger(__name__)
import time
import os


@app.task(base=LogErrorsTask, bind=True)
def execute_sql_in_virtual_db_task(
    self, user: str, results_dir: str, sql_statement: str, filestore_location: str
):
    if self.request.called_directly:
        task_id = "called_directly"
    else:
        task_id = self.request.id

    os.makedirs(results_dir, exist_ok=True)
    output_filename = f"{results_dir}/{task_id}"
    log.warning(
        f"Starting SQL execution: {sql_statement}, writing to {output_filename}"
    )

    with db_context(user) as db:
        output = sql.execute_sql_in_virtual_db(db, filestore_location, sql_statement)
        with open(output_filename, "wt") as fd:
            for line in output:
                fd.write(line)

    log.warning(f"Completed SQL execution, wrote to {output_filename}")
    return output_filename
