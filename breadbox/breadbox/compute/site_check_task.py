from breadbox.compute.celery import app, LogErrorsTask


@app.task(base=LogErrorsTask, bind=True)
def is_ok(self):
    return "SUCCESS"
