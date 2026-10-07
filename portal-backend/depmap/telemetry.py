import logging
import sys
from importlib.metadata import PackageNotFoundError, version

from flask import Flask
from opentelemetry import trace
from opentelemetry.exporter.cloud_trace import CloudTraceSpanExporter
from opentelemetry.instrumentation.celery import CeleryInstrumentor
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

log = logging.getLogger(__name__)


def _service_version() -> str:
    try:
        return version("depmap")
    except PackageNotFoundError:
        return "unknown"


# The `flask` CLI commands that start a Celery worker (see cli_commands/spawn_commands.py).
_WORKER_COMMANDS = ("run_worker", "run_dev_worker")


def is_celery_worker_process() -> bool:
    """True if this process was started as `flask run_worker` (or run_dev_worker). The flask CLI
    calls create_app in the parent worker process before Celery forks its children, so
    create_app uses this to avoid configuring web tracing there."""
    # sys.argv[0] is the program (e.g. "flask"); sys.argv[1] is the subcommand, if there is one
    if len(sys.argv) < 2:
        return False
    return sys.argv[1] in _WORKER_COMMANDS


def _set_up_provider(service: str, env_name: str):
    resource = Resource.create(
        {
            "service.name": f"{service}-{env_name}",
            "service.version": _service_version(),
        }
    )
    provider = TracerProvider(resource=resource)
    provider.add_span_processor(
        BatchSpanProcessor(
            CloudTraceSpanExporter(
                # Attributes with keys matching this regex will be added to exported spans as labels
                # This is necessary to populate the service name field in GCP
                resource_regex=r"service\..*"
            )
        )
    )
    trace.set_tracer_provider(provider)
    log.info("Cloud Trace tracing enabled for %s-%s", service, env_name)


def _tracing_disabled(env_name: str) -> bool:
    return env_name in ("dev", "test")


def configure_tracing(app: Flask, service: str, env_name: str):
    """Sets up a global OpenTelemetry TracerProvider exporting to Google Cloud Trace for the web
    process, and instruments Flask, requests, and Celery (the task-publishing side). Call this
    once from create_app, after the Flask app has been constructed.

    Does nothing when env_name is "dev" or "test", so this is safe to call locally and in tests
    without GCP credentials.
    """
    if _tracing_disabled(env_name):
        return

    _set_up_provider(service, env_name)
    FlaskInstrumentor().instrument_app(app)
    RequestsInstrumentor().instrument()
    CeleryInstrumentor().instrument()


def configure_celery_worker_tracing(service: str, env_name: str):
    """Sets up tracing inside a Celery worker child process, reporting under its own service name
    (e.g. "depmap-celery-<env>") so worker spans are separate from web spans. Must be called from
    the worker_process_init signal, i.e. after forking, because the BatchSpanProcessor's export
    thread doesn't survive a fork.
    """
    if _tracing_disabled(env_name):
        return

    _set_up_provider(service, env_name)
    RequestsInstrumentor().instrument()
    CeleryInstrumentor().instrument()


def flush_tracing():
    """Export any spans still buffered in the BatchSpanProcessor. Call before a short-lived
    process exits, otherwise its last spans can be dropped before the periodic export fires."""
    provider = trace.get_tracer_provider()
    if isinstance(provider, TracerProvider):
        provider.shutdown()
