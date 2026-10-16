import pytest
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from breadbox.api.utils import get_response_with_etag


@pytest.mark.parametrize(
    "if_none_match, expected_outcome, expected_status",
    [(None, "none", 200), ("stale-etag", "miss", 200), ("current-etag", "hit", 304),],
)
def test_get_response_with_etag_records_outcome_on_span(
    if_none_match, expected_outcome, expected_status
):
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    tracer = provider.get_tracer(__name__)

    callback_calls = []

    def callback():
        callback_calls.append(1)
        return {"a": 1}

    with tracer.start_as_current_span("request"):  # pyright: ignore
        response = get_response_with_etag("current-etag", if_none_match, callback, None)

    assert response.status_code == expected_status
    # the callback should only run when we actually render
    assert len(callback_calls) == (0 if expected_outcome == "hit" else 1)

    (span,) = exporter.get_finished_spans()
    assert span.attributes["etag.outcome"] == expected_outcome  # pyright:ignore
