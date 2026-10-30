import http.server
import threading

import pytest
from werkzeug.test import Client

from depmap.tweaked_proxy import ProxyMiddlewareWithLogging


@pytest.fixture
def upstream():
    """A stub server that records the request headers it receives."""
    received = []

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            received.append(self.headers.get_all("Accept-Encoding"))
            self.send_response(200)
            self.send_header("Content-Length", "2")
            self.send_header("Content-Encoding", "gzip")
            self.end_headers()
            self.wfile.write(b"ok")

        def log_message(self, format, *args):
            pass

    server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_port}", received
    server.shutdown()
    server.server_close()


def make_client(target):
    proxy = ProxyMiddlewareWithLogging(
        lambda environ, start_response: [b"app"],
        {"/breadbox/": {"target": target, "remove_prefix": True}},
    )
    return Client(proxy)


def test_forwards_clients_accept_encoding(upstream):
    target, received = upstream
    response = make_client(target).get(
        "/breadbox/x", headers={"Accept-Encoding": "gzip"}
    )

    assert response.status_code == 200
    # http.client's default "identity" must not be sent alongside (or instead of) it
    assert received == [["gzip"]]


def test_passes_through_content_encoding(upstream):
    target, _ = upstream
    response = make_client(target).get(
        "/breadbox/x", headers={"Accept-Encoding": "gzip"}
    )

    assert response.headers["Content-Encoding"] == "gzip"
