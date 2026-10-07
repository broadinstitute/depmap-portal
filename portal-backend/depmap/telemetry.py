import logging
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


def configure_tracing(app: Flask, service: str, env_name: str):
    """Sets up a global OpenTelemetry TracerProvider exporting to Google Cloud Trace, and
    instruments Flask, requests, and Celery (the task-publishing side). Call this once from
    create_app, after the Flask app has been constructed.

    Does nothing when env_name is "dev" or "test", so this is safe to call locally and in tests
    without GCP credentials.
    """
    if env_name in ("dev", "test"):
        return

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

    FlaskInstrumentor().instrument_app(app)
    RequestsInstrumentor().instrument()
    CeleryInstrumentor().instrument()
    log.info("Cloud Trace tracing enabled for %s-%s", service, env_name)
