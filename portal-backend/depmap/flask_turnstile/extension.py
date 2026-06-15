import re
import urllib.parse

import requests
from flask import Blueprint, redirect, render_template, request
from itsdangerous import BadSignature, SignatureExpired, TimestampSigner
from typing import cast, Optional


class Turnstile:
    def __init__(self, app=None):
        if app is not None:
            self.init_app(app)

    def init_app(self, app):
        for key in ("TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY", "SECRET_KEY"):
            if not app.config.get(key):
                raise RuntimeError(f"Flask-Turnstile requires {key} in app.config")

        blueprint = Blueprint(
            "verify_turnstile", __name__, template_folder="templates",
        )

        def verify():
            parameters: dict[str, Optional[str]] = cast(
                dict[str, Optional[str]], request.form
            )
            token = parameters.get("cf-turnstile-response", "")
            next_url = parameters.get("next_url", "/")
            assert isinstance(next_url, str)

            request_url: str = cast(str, request.url)
            assert isinstance(request_url, str)

            parsed = urllib.parse.urlparse(next_url)
            if parsed.scheme or parsed.netloc:
                req_parsed = urllib.parse.urlparse(request_url)
                if (
                    parsed.scheme != req_parsed.scheme
                    or parsed.netloc != req_parsed.netloc
                ):
                    return "Invalid next_url", 400

            secret_key = app.config["TURNSTILE_SECRET_KEY"]
            site_key = app.config["TURNSTILE_SITE_KEY"]

            try:
                resp = requests.post(
                    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                    json={"secret": secret_key, "response": token},
                    timeout=10,
                )
                data = resp.json()
            except Exception as exc:
                app.logger.error("Turnstile verification request failed: %s", exc)
                response = redirect(next_url)
                _set_cookie(app, response)
                return response

            if not data.get("success"):
                return render_template(
                    "turnstile_challenge.html",
                    site_key=site_key,
                    next_url=next_url,
                    error=True,
                )

            response = redirect(next_url)
            _set_cookie(app, response)
            return response

        blueprint.add_url_rule(
            "/verify-turnstile-token",
            endpoint="verify",
            view_func=verify,
            methods=["POST"],
        )
        app.register_blueprint(blueprint)

        @app.before_request
        def _gate():
            if request.endpoint == "verify_turnstile.verify":
                return None

            bypass_patterns: list[str] = app.config.get("TURNSTILE_BYPASS", [])
            request_path: str = cast(str, request.path)
            assert isinstance(request_path, str)
            for pattern in bypass_patterns:
                if re.match(pattern, request_path):
                    print("Bypassing due to", pattern)
                    return None

            cookie_value = request.cookies.get("PROBABLY_HUMAN")  # pyright: ignore
            if cookie_value:
                signer = TimestampSigner(app.config["SECRET_KEY"])
                max_age = app.config.get("TURNSTILE_COOKIE_EXPIRY", 604800)
                try:
                    signer.unsign(cookie_value, max_age=max_age)
                    return None
                except (SignatureExpired, BadSignature):
                    pass

            return render_template(
                "turnstile_challenge.html",
                site_key=app.config["TURNSTILE_SITE_KEY"],
                next_url=request.url,
                error=False,
            )


def _set_cookie(app, response):
    signer = TimestampSigner(app.config["SECRET_KEY"])
    signed = signer.sign("1").decode()
    max_age = app.config.get("TURNSTILE_COOKIE_EXPIRY", 604800)
    response.set_cookie(
        "PROBABLY_HUMAN",
        signed,
        max_age=max_age,
        httponly=True,
        secure=True,
        samesite="Strict",
    )
