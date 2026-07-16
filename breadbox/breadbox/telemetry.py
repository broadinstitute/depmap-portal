from importlib.metadata import version

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.cloud_trace import CloudTraceSpanExporter
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.logging import LoggingInstrumentor

from .config import Settings


def configure_tracing(settings: Settings):
    """Sets up a global OpenTelemetry TracerProvider exporting to Google Cloud Trace, and
    instruments httpx and stdlib logging. Call this once, before any instrumented code runs
    (e.g. before create_app()).

    No-ops (aside from log record enrichment) when tracing is disabled, so this is safe to call
    in local dev without GCP credentials.
    """
    # Always instrument logging so every LogRecord has otelTraceID/otelSpanID attributes, since
    # breadbox's LOG_FORMAT references them unconditionally (they're "0" when there's no active
    # span, e.g. because tracing is disabled below).
    LoggingInstrumentor().instrument(set_logging_format=False)

    if not settings.otel_enabled or settings.breadbox_env == "dev":
        return

    resource = Resource.create(
        {
            "service.name": settings.otel_service_name,
            "service.version": version("breadbox"),
        }
    )
    provider = TracerProvider(resource=resource)
    provider.add_span_processor(BatchSpanProcessor(CloudTraceSpanExporter()))
    trace.set_tracer_provider(provider)

    HTTPXClientInstrumentor().instrument()
