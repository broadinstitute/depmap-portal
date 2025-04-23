from celery.bin.celery import main
import click
import subprocess
from flask.cli import with_appcontext
from flask import current_app


@click.command("webpack")
def webpack():
    subprocess.call(["yarn", "dev:portal"], cwd="../frontend")


# ignore_unknown_options and nargs allows us to collect all remaining args and pass them on the cmd line
@click.command("run_worker", context_settings={"ignore_unknown_options": True})
@click.option(
    "--name",
    default="unknown",
    # help="Has no effect but useful for putting the name of the environment in the command line to make it easier to identify which env this process belongs to",
)
@click.argument("celery_args", nargs=-1)
@with_appcontext
def run_worker(name, celery_args):
    """Starts a celery workers for running background jobs (and pass in any additional config via command line args)"""
    if len(celery_args) == 0:
        # the compute tasks cause a memory leak. we replace the worker process after every job to fix this
        celery_args = ["--max-tasks-per-child", "1"]
    print(f"Starting worker named {name} with args {celery_args}")
    _run_worker(celery_args)


@click.command("run_dev_worker")
@with_appcontext
def run_dev_worker():
    """Starts a celery worker with some settings to make it easier to debug with. (concurrency of 1 and solo pool so there's less confusion from multiple workers and disable capturing stdout)"""
    from werkzeug._reloader import run_with_reloader

    extra_files = []
    reloader_interval = 1
    reloader_type = "auto"

    # main func executes in a different thread, so current_app won't work there. To work around this, pass the caller's app to the method and create a new context there.
    flask_app = current_app._get_current_object()

    def main_func():
        from depmap.compute.celery import app as celery_app

        with flask_app.app_context():
            celery_app.conf.worker_redirect_stdouts = False
            _run_worker(["--pool=solo", "-c", "1"])

    run_with_reloader(main_func, extra_files, reloader_interval, reloader_type)
