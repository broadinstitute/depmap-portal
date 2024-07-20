from depmap.compute.celery import app
import celery


@app.task(bind=True)
def task_health_check(self: celery.Task):
    return "SUCCESS"
