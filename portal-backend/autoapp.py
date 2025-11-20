# -*- coding: utf-8 -*-
"""Create an application instance."""
import os
from typing import Dict, Any, Optional


import faulthandler
import signal
from .tweaked_proxy import ProxyMiddlewareWithLogging
from werkzeug.wrappers import Request, Response
from depmap.read_config import read_config
from itsdangerous import Serializer


def get_config(env_name, config_path=None):
    config = read_config(env_name, config_path)
    assert config.SECRET_KEY is not None

    print("Using environment: {}".format(env_name))
    print("Using Breadbox proxy address: {}".format(config.BREADBOX_PROXY_TARGET))

    override_file = os.getenv("DEPMAP_OVERRIDES")
    if override_file is not None:
        with open(override_file, "rt") as fd:
            vars: Dict[str, Any] = {}
            code = compile(fd.read(), override_file, "exec")
            exec(code, vars, vars)

        for name, value in vars.items():
            if name.upper() == name:
                setattr(config, name, value)

    return config


# NOTE: See https://peps.python.org/pep-0333/#middleware-components-that-play-both-sides
class UserOverrideMiddleware:
    def __init__(
        self,
        app,
        proxy: ProxyMiddlewareWithLogging,
        serializer: Serializer,
        user_override: Optional[str],
    ):
        self.app = app
        self.proxy = proxy
        self.serializer = serializer
        self.user_override = user_override

    def __call__(self, environ, start_response):
        """
        See https://werkzeug.palletsprojects.com/en/2.3.x/wrappers/ for more info on WSGI environment and response objects
        """

        def update_environ_header(name, value):
            keys_to_remove = [k for k in environ.keys() if k.upper() == name.upper()]
            for k in keys_to_remove:
                del environ[k]

            # if we're trying to set the value to None, just leave the key unset
            if value is not None:
                environ[name] = value

        # NOTE: See Standard environ keys: https://wsgi.readthedocs.io/en/latest/definitions.html
        if environ["PATH_INFO"].startswith("/breadbox"):
            # Allow navigating to /breadbox/elara without a trailing slash
            if environ["PATH_INFO"] == "/breadbox/elara":
                return Response(
                    "", status=307, headers={"Location": "/breadbox/elara/"}
                )(environ, start_response)

            request = Request(environ)
            signed_user_override = request.cookies.get(
                "breadbox_username_override", None
            )

            if signed_user_override:
                user_override = self.serializer.loads(signed_user_override)
                print(
                    f"Overriding user info before forwarding to breadbox with {user_override} (headers were: {request.headers.get('X-Forwarded-Email')}, {request.headers.get('X-Forwarded-User')})"
                )
            else:
                # if we don't have a cookie set with which user to use, then the value that we
                # have on the this instance, configured on startup
                user_override = self.user_override

            if user_override is not None:
                # if the two methods to find the override don't actually yield a valid value
                # then leave the headers alone. The intention is that this is the behavior in dev
                # where people may want to monkey with headers for testing.

                # modifies environ to affect what the wrapped application sees
                update_environ_header("HTTP_X_FORWARDED_USER", user_override)
                update_environ_header("HTTP_X_FORWARDED_EMAIL", user_override)

            return self.proxy(environ, start_response)

        else:
            return self.app(environ, start_response)


# NOTE: Avoid adding breakpoint in below function since Flask's "magic reload" watches for changes in this file to restart app and then actually runs it which somehow makes this function run twice?
def setup_middleware(app, CONFIG):
    def _no_content_response(env, resp):
        resp(b"200 OK", [("Content-Type", "text/plain")])
        return [
            ("No content here, look under " + CONFIG.APPLICATION_ROOT).encode("utf8")
        ]

    # NOTE: UserOverrideMiddleware must come before ProxyMiddleware in the call chain or else /breadbox url prefix won't be added in request path
    # If UserOverrideMiddle instance didn't take in a ProxyMiddleware as an argument, we'd need to set app.wsgi_app to ProxyMiddleware first,
    # then app.wsgi_app to UserOverrideMiddleware since the latest one set becomes first in the call chain
    app.wsgi_app = UserOverrideMiddleware(
        app.wsgi_app,
        ProxyMiddlewareWithLogging(
            app.wsgi_app,
            {
                "/breadbox/": {
                    "target": CONFIG.BREADBOX_PROXY_TARGET,
                    "remove_prefix": True,
                }
            },
        ),
        Serializer(CONFIG.SECRET_KEY),
        CONFIG.BREADBOX_PROXY_DEFAULT_USER,
    )

    if CONFIG.APPLICATION_ROOT != "/":
        from werkzeug.wsgi import DispatcherMiddleware

        app.wsgi_app = DispatcherMiddleware(
            _no_content_response, {CONFIG.APPLICATION_ROOT: app.wsgi_app}
        )

    from flask_hunter_profile.middleware import ProfilingMiddleware
    from flask_hunter_profile.service import Config

    app.wsgi_app = ProfilingMiddleware(
        app.wsgi_app, Config(CONFIG.PROFILE_DIR, CONFIG.PROFILE_COOKIE_NAME)
    )

    return app


# set up this process such that we print the current thread's backtrace when this signal is received
# useful for debugging cases where the process hangs but we don't know what it's doing.
faulthandler.register(signal.SIGQUIT)

# select the right config based on DEPMAP_ENV environment variable, defaulting to "dev"
env_name = os.getenv("DEPMAP_ENV", "dev")
config_path = os.getenv("CONFIG_PATH", None)
CONFIG = get_config(env_name=env_name, config_path=config_path)

# now, create app with the config
from depmap.app import create_app

app = create_app(CONFIG)
app = setup_middleware(app, CONFIG)

# force commit2
