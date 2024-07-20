import hashlib
from flask import request, current_app, abort
from depmap.authentication.hmacauth import HmacAuth, AuthenticationResultCodes


def verify_oauth_request_signature():
    """
    Verify that the request came from oauth, by verifying the request signature
    Copied from hmac_authentication.hmacauth.HmacMiddleware (the original library)
    """
    with open(current_app.config["OAUTH_SIGNATURE_KEY"], "r") as fd:
        oauth_signature_key = fd.read()

    # obtained from https://github.com/oauth2-proxy/oauth2-proxy/blob/33e04cc52f301b6ee932e103b142c60e98851f99/pkg/upstream/http.go#L27
    HEADERS = [
        "Content-Length",
        "Content-Md5",
        "Content-Type",
        "Date",
        "Authorization",
        "X-Forwarded-User",
        "X-Forwarded-Email",
        "X-Forwarded-Preferred-User",
        "X-Forwarded-Access-Token",
        "Cookie",
        "Gap-Auth",
    ]

    hmac_auth = HmacAuth(hashlib.sha1, oauth_signature_key, "Gap-Signature", HEADERS)
    result = hmac_auth.authenticate_request(request.environ, request)
    is_valid_user = result.result_code == AuthenticationResultCodes.MATCH
    if not is_valid_user:
        # Falling here might mean a security breach, that a request is somehow being passed to the portal without passing through oauth
        # It might also mean that oauth was not propertly configured to sign the request
        # Verify that the oauth config for the server has provided signature_key, and uses the same set of headers
        abort(401)
