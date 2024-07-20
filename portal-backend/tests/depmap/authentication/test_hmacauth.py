"""
Largely copied from tests from the https://github.com/18F/hmac_authentication_py library
See modifications in authentication/hmacauth.py
"""

import sys
import hashlib

import six
import flask
import pytest

from depmap.authentication.hmacauth import get_uri, HmacAuth, AuthenticationResultCodes


# These correspond to the headers used in bitly/oauth2_proxy#147.
HEADERS = [
    "Content-Length",
    "Content-Md5",
    "Content-Type",
    "Date",
    "Authorization",
    "X-Forwarded-User",
    "X-Forwarded-Email",
    "X-Forwarded-Access-Token",
    "Cookie",
    "Gap-Auth",
]


@pytest.fixture
def auth():
    return HmacAuth(hashlib.sha1, "foobar", "Gap-Signature", HEADERS)


@pytest.fixture
def test_request():
    return flask.Request(
        {
            "REQUEST_METHOD": "GET",
            "wsgi.url_scheme": "http",
            "SERVER_NAME": "localhost",
            "SERVER_PORT": "80",
            "PATH_INFO": "/foo/bar?baz=quux%2Fxyzzy#plugh",
        }
    )


def test_get_uri():
    environ = {"PATH_INFO": "/data"}
    assert get_uri(environ) == "/data"


def test_get_uri_query_string():
    environ = {"PATH_INFO": "/data", "QUERY_STRING": "foo=bar"}
    assert get_uri(environ) == "/data?foo=bar"


def test_get_uri_script_name():
    environ = {"PATH_INFO": "/data", "SCRIPT_NAME": "/proxy"}
    assert get_uri(environ) == "/proxy/data"


def test_request_signature_post(auth):
    payload = '{ "hello": "world!" }'
    environ = {
        "REQUEST_METHOD": "POST",
        "wsgi.url_scheme": "http",
        "SERVER_NAME": "localhost",
        "SERVER_PORT": "80",
        "PATH_INFO": "/foo/bar",
        "CONTENT_TYPE": "application/json",
        "CONTENT_LENGTH": len(payload),
        "HTTP_CONTENT_MD5": "deadbeef",
        "HTTP_DATE": "2015-09-28",
        "HTTP_AUTHORIZATION": "trust me",
        "HTTP_X_FORWARDED_USER": "mbland",
        "HTTP_X_FORWARDED_EMAIL": "mbland@acm.org",
        "HTTP_X_FORWARDED_ACCESS_TOKEN": "feedbead",
        "HTTP_COOKIE": "foo; bar; baz=quux",
        "HTTP_GAP_AUTH": "mbland",
        "wsgi.input": six.BytesIO(payload.encode("utf8")),
    }
    test_request = flask.Request(environ)
    expected = (
        "\n".join(
            [
                "POST",
                str(len(payload)),
                "deadbeef",
                "application/json",
                "2015-09-28",
                "trust me",
                "mbland",
                "mbland@acm.org",
                "feedbead",
                "foo; bar; baz=quux",
                "mbland",
                "/foo/bar",
            ]
        )
        + "\n"
    )
    assert expected == auth.string_to_sign(environ)
    assert "sha1 K4IrVDtMCRwwW8Oms0VyZWMjXHI=" == auth.request_signature(
        environ, test_request
    )


def test_request_signature_get(auth):
    environ = {
        "REQUEST_METHOD": "GET",
        "wsgi.url_scheme": "http",
        "SERVER_NAME": "localhost",
        "SERVER_PORT": "80",
        "PATH_INFO": "/foo/bar?baz=quux%2Fxyzzy#plugh",
        "HTTP_DATE": "2015-09-29",
        "HTTP_COOKIE": "foo; bar; baz=quux",
        "HTTP_GAP_AUTH": "mbland",
    }
    test_request = flask.Request(environ)
    expected = (
        "\n".join(
            [
                "GET",
                "",
                "",
                "",
                "2015-09-29",
                "",
                "",
                "",
                "",
                "foo; bar; baz=quux",
                "mbland",
                "/foo/bar?baz=quux%2Fxyzzy#plugh",
            ]
        )
        + "\n"
    )
    assert expected == auth.string_to_sign(environ)
    assert "sha1 ih5Jce9nsltry63rR4ImNz2hdnk=" == auth.request_signature(
        environ, test_request
    )


def test_authenticate_request_no_signature(auth, test_request):
    result, header, computed = auth.authenticate_request(
        test_request.environ, test_request
    )
    assert AuthenticationResultCodes.NO_SIGNATURE == result
    assert header is None
    assert computed is None


def test_authenticate_request_invalid_format(auth, test_request):
    bad_value = "should be algorithm and digest value"
    test_request.environ["HTTP_GAP_SIGNATURE"] = bad_value
    result, header, computed = auth.authenticate_request(
        test_request.environ, test_request
    )
    assert AuthenticationResultCodes.INVALID_FORMAT == result
    assert bad_value == header
    assert computed is None


def test_authenticate_request_unsupported_algorithm(auth, test_request):
    valid_signature = auth.request_signature(test_request.environ, test_request)
    components = valid_signature.split(" ")
    signature_with_unsupported_algorithm = "unsupported " + components[1]
    test_request.environ["HTTP_GAP_SIGNATURE"] = signature_with_unsupported_algorithm
    result, header, computed = auth.authenticate_request(
        test_request.environ, test_request
    )
    assert AuthenticationResultCodes.UNSUPPORTED_ALGORITHM == result
    assert signature_with_unsupported_algorithm == header
    assert computed is None


def test_authenticate_request_match(auth, test_request):
    expected_signature = auth.request_signature(test_request.environ, test_request)
    auth.sign_request(test_request.environ, test_request)
    result, header, computed = auth.authenticate_request(
        test_request.environ, test_request
    )
    assert AuthenticationResultCodes.MATCH == result
    assert expected_signature == header
    assert expected_signature == computed


def test_authenticate_request_mismatch(auth, test_request):
    barbaz_auth = HmacAuth(hashlib.sha1, "barbaz", "Gap-Signature", HEADERS)
    auth.sign_request(test_request.environ, test_request)
    result, header, computed = barbaz_auth.authenticate_request(
        test_request.environ, test_request
    )
    assert AuthenticationResultCodes.MISMATCH == result
    assert auth.request_signature(test_request.environ, test_request) == header
    assert barbaz_auth.request_signature(test_request.environ, test_request) == computed


def to_string(value):
    if sys.version_info[0] == 2:
        return value.encode()
    return value
