from breadbox.compute.celery import app


@app.task(bind=True)
def is_ok(self):
    return "SUCCESS"
