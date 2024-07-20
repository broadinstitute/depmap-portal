"""
This file is copied from https://github.com/18F/hmac_authentication_py and modified to use flask's request object
The intention is to call .get_data() on flask's request object
Otherwise, in the original code, the payload from a POST request is consumed and cannot later be read
Flask's request object caches the payload

Just adding an extra request parameter because it was easier.
    We don't use the request_signature function, but it is used in tests and is easier to also not modify
Also removed HmacMiddleware, because we have duplicate-re-implemented its code in authentication/utils.py, and because change 1) requires changes to the original implementation that looked annoying
"""


import enum
import hmac
import base64
import hashlib
import collections


AuthenticationResult = collections.namedtuple(
    "AuthenticationResult", ["result_code", "header_signature", "computed_signature"],
)


class AuthenticationResultCodes(enum.Enum):
    """Defines the result codes used in AuthenticationResult."""

    # The incoming result did not have a signature header
    NO_SIGNATURE = 1

    # The signature header was not parseable
    INVALID_FORMAT = 2

    # The signature header specified an unsupported algorithm
    UNSUPPORTED_ALGORITHM = 3

    # The signature from the request header matched the locally-computed
    # signature
    MATCH = 4

    # The signature from the request header did not match the locally-computed
    # signature
    MISMATCH = 5


def header_name_to_wsgi(header_name):
    wsgi_name = header_name.upper().replace("-", "_")
    if wsgi_name not in ["CONTENT_TYPE", "CONTENT_LENGTH"]:
        wsgi_name = "HTTP_" + wsgi_name
    return wsgi_name


def _compare_signatures(header, computed):
    if hmac.compare_digest(header.encode("utf8"), computed.encode("utf8")):
        return AuthenticationResultCodes.MATCH
    return AuthenticationResultCodes.MISMATCH


def get_uri(environ):
    uri = environ.get("SCRIPT_NAME", "") + environ.get("PATH_INFO", "/")
    if environ.get("QUERY_STRING"):
        uri = "{}?{}".format(uri, environ["QUERY_STRING"])
    return uri


class HmacAuth(object):
    """HmacAuth signs outbound requests and authenticates inbound requests.

    Note that the method parameters called "req" or "request" correspond to
    the WSGI "environ" interface define in PEP 333:
      https://www.python.org/dev/peps/pep-0333/
    """

    def __init__(self, digest, secret_key, signature_header, headers):
        self._digest = digest
        self._secret_key = secret_key
        self._signature_header = header_name_to_wsgi(signature_header)
        self._headers = [header_name_to_wsgi(h) for h in headers]

    # Note that compile multiply-defined headers should always be rewritten as
    # a single header:
    # http://stackoverflow.com/questions/1801124/how-does-wsgi-handle-multiple-request-headers-with-the-same-name
    def _signed_headers(self, environ):
        return [str(environ.get(h, "")) for h in self._headers]

    def string_to_sign(self, environ):
        """Produces the string that will be prefixed to the request body and
        used to generate the signature.
        """
        components = [environ["REQUEST_METHOD"]]
        components.extend(self._signed_headers(environ))
        components.append(get_uri(environ))
        return "\n".join(components) + "\n"

    # NOTE(mbland): I'm not sure the outbound WSGI HTTP request interface is
    # symmetrical to the inbound "environ" interface. Must go deeper.
    def sign_request(self, environ, request):
        """Adds a signature header to the request."""
        environ[self._signature_header] = self.request_signature(environ, request)

    def request_signature(self, environ, request):
        """Generates a signature for the request."""
        return self._request_signature(environ, self._digest, request)

    def _request_signature(self, environ, digest, request):
        h = hmac.new(
            self._secret_key.encode("utf8"),
            self.string_to_sign(environ).encode("utf8"),
            digest,
        )
        # request = Request(environ)
        if "wsgi.input" in environ:
            h.update(request.get_data())
        return digest().name + " " + base64.b64encode(h.digest()).decode("utf8")

    def signature_from_header(self, environ):
        """Retrieves the signature included in the request header."""
        return environ.get(self._signature_header)

    def authenticate_request(self, environ, request):
        """Authenticates the request by comparing HMAC signatures.

        Returns the result code, the signature from the header, and the
        locally-computed signature as a AuthenticationResult.
        """
        header = self.signature_from_header(environ)
        if header is None:
            return AuthenticationResult(
                AuthenticationResultCodes.NO_SIGNATURE, None, None
            )
        components = header.split(" ")

        if len(components) != 2:
            return AuthenticationResult(
                AuthenticationResultCodes.INVALID_FORMAT, header, None
            )

        digest_name = components[0]
        try:
            digest = getattr(hashlib, digest_name)
        except AttributeError:
            return AuthenticationResult(
                AuthenticationResultCodes.UNSUPPORTED_ALGORITHM, header, None
            )

        computed = self._request_signature(environ, digest, request)
        return AuthenticationResult(
            _compare_signatures(header, computed), header, computed
        )
