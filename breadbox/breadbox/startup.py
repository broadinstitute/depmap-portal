import os
import pathlib

from fastapi.routing import APIRouter

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.datastructures import MutableHeaders

from .api import api_router
from .config import Settings
from .ui import SinglePageApplication
from .api.proxy import router as proxy_router
from importlib.metadata import version


def create_app(settings: Settings):
    api_prefix = settings.api_prefix

    app = FastAPI(
        title="Breadbox",
        openapi_url=f"{api_prefix}/openapi.json",
        docs_url=f"{api_prefix}/docs",
        redoc_url=f"{api_prefix}/redoc",
        swagger_ui_oauth2_redirect_url=f"{api_prefix}/docs/oauth2-redirect",
        version=version("breadbox"),
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    if api_prefix != "":
        root_router = APIRouter(prefix=api_prefix)
        root_router.include_router(api_router)
    else:
        root_router = api_router
    app.include_router(root_router)

    # For Elara breadbox development only. When enabled, this option will proxy all
    # requests that have a /depmap/ prefix to http://localhost:5000 (i.e. the
    # portal's Flask server). To enable this feature, edit the ./breadbox/.env file
    # and set USE_DEPMAP_PROXY = True
    if settings.use_depmap_proxy:
        app.include_router(proxy_router)

    app.mount(
        f"{api_prefix}/elara",
        SinglePageApplication(directory=pathlib.Path("breadbox/static/elara")),
        name="elara",
    )

    if settings.host_scheme_override is not None:
        scheme_override, host_override = settings.host_scheme_override.split(":", 1)
        app.add_middleware(
            OverrideMiddleWare,
            scheme_override=scheme_override,
            host_override=host_override,
        )

    return app


def ensure_directories_exist(settings):
    if not os.path.exists(settings.filestore_location):
        os.mkdir(settings.filestore_location)


class OverrideMiddleWare:
    def __init__(self, app, scheme_override=None, host_override=None):
        self.app = app
        # host is of the format <hostname>:<port>
        self.host_override = host_override
        self.scheme_override = scheme_override

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        if self.host_override:
            # MutableHeaders is a proxy which will mutate the scope['headers'] field. Just gives us
            # a more convenient api to make changes
            headers = MutableHeaders(scope=scope)
            headers["host"] = self.host_override

        if self.scheme_override:
            scope["scheme"] = self.scheme_override

        await self.app(scope, receive, send)


