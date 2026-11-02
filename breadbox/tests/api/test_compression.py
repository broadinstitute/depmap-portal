import pytest


@pytest.fixture
def compression_client(client, app):
    @app.get("/test-compression/big")
    def big():
        return {"values": list(range(500))}

    @app.get("/test-compression/small")
    def small():
        return {"ok": True}

    return client


def test_large_json_is_gzipped(compression_client):
    response = compression_client.get(
        "/test-compression/big", headers={"Accept-Encoding": "gzip"}
    )
    assert response.status_code == 200
    assert response.headers["Content-Encoding"] == "gzip"
    # TestClient (httpx) transparently decodes the body
    assert response.json() == {"values": list(range(500))}


def test_small_json_not_compressed(compression_client):
    response = compression_client.get(
        "/test-compression/small", headers={"Accept-Encoding": "gzip"}
    )
    assert "Content-Encoding" not in response.headers


def test_no_accept_encoding_is_identity(compression_client):
    response = compression_client.get(
        "/test-compression/big", headers={"Accept-Encoding": "identity"}
    )
    assert "Content-Encoding" not in response.headers
