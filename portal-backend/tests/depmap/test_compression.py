import gzip
import json

import brotli
import flask
import pytest

BIG_TEXT = "hello compression " * 200
BIG_JSON = {"values": list(range(500))}


@pytest.fixture
def client(app, tmpdir):
    # serve a real file through Flask's static endpoint, like the webpack bundles
    tmpdir.join("bundle.js").write("var x = 1;\n" * 200)
    app.static_folder = str(tmpdir)
    zip_path = tmpdir.join("data.zip")
    zip_path.write("PK" * 500)

    app.add_url_rule("/t/big-text", "t_big_text", lambda: BIG_TEXT)
    app.add_url_rule("/t/small-text", "t_small_text", lambda: "tiny")
    app.add_url_rule("/t/big-json", "t_big_json", lambda: flask.jsonify(BIG_JSON))
    app.add_url_rule(
        "/t/big-csv",
        "t_big_csv",
        lambda: flask.Response(BIG_TEXT, mimetype="text/csv"),
    )
    app.add_url_rule(
        "/t/zip",
        "t_zip",
        lambda: flask.send_file(
            str(zip_path), mimetype="application/zip", as_attachment=True
        ),
    )

    def pre_encoded():
        response = flask.Response(BIG_TEXT)
        response.headers["Content-Encoding"] = "identity"
        return response

    app.add_url_rule("/t/pre-encoded", "t_pre_encoded", pre_encoded)
    return app.test_client()


def get(client, path, encoding):
    headers = {} if encoding is None else {"Accept-Encoding": encoding}
    return client.get(path, headers=headers)


def test_large_text_is_gzipped(client):
    response = get(client, "/t/big-text", "gzip")
    assert response.headers["Content-Encoding"] == "gzip"
    assert "Accept-Encoding" in response.headers["Vary"]
    assert gzip.decompress(response.data).decode() == BIG_TEXT


def test_brotli_preferred_when_offered(client):
    response = get(client, "/t/big-json", "gzip, br")
    assert response.headers["Content-Encoding"] == "br"
    assert json.loads(brotli.decompress(response.data)) == BIG_JSON


def test_no_accept_encoding_is_identity(client):
    response = get(client, "/t/big-text", None)
    assert "Content-Encoding" not in response.headers
    assert response.data.decode() == BIG_TEXT


def test_small_response_not_compressed(client):
    response = get(client, "/t/small-text", "gzip, br")
    assert "Content-Encoding" not in response.headers


def test_already_encoded_response_untouched(client):
    response = get(client, "/t/pre-encoded", "gzip, br")
    assert response.headers["Content-Encoding"] == "identity"
    assert response.data.decode() == BIG_TEXT


def test_downloads_not_compressed(client):
    for path in ["/t/big-csv", "/t/zip"]:
        response = get(client, path, "gzip, br")
        assert "Content-Encoding" not in response.headers, path


def test_vary_cookie_is_preserved(client, app):
    def with_session():
        flask.session["x"] = 1
        return BIG_TEXT

    app.add_url_rule("/t/with-session", "t_with_session", with_session)
    response = get(client, "/t/with-session", "gzip")
    vary = response.headers["Vary"]
    assert "Cookie" in vary and "Accept-Encoding" in vary


def test_streamed_static_file_is_compressed(client):
    response = get(client, "/static/bundle.js", "gzip")
    assert response.headers["Content-Encoding"] == "gzip"
    assert gzip.decompress(response.data).decode() == "var x = 1;\n" * 200


def test_conditional_request_gets_304(client):
    first = get(client, "/static/bundle.js", "gzip")
    etag = first.headers.get("ETag")
    assert etag
    # the ETag must identify the compressed variant, so it can't match the identity one
    assert etag != get(client, "/static/bundle.js", None).headers["ETag"]
    second = client.get(
        "/static/bundle.js", headers={"Accept-Encoding": "gzip", "If-None-Match": etag}
    )
    assert second.status_code == 304
    assert not second.data
