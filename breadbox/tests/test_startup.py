from .factories import SettingsFactory
from breadbox.startup import create_app
from fastapi import APIRouter, Request
from fastapi.testclient import TestClient
import pytest
import typing
from breadbox import config


@pytest.mark.parametrize("api_prefix", ["", "/v1/api"])
def test_api_prefix(api_prefix):
    settings = typing.cast(config.Settings, SettingsFactory(api_prefix=api_prefix))
    app = create_app(settings)
    client = TestClient(app)

    response = client.get(f"{api_prefix}/invalid")
    assert response.status_code == 404

    response = client.get(f"{api_prefix}/docs")
    assert response.status_code == 200

    response = client.get(f"{api_prefix}/health_check/basic")
    assert response.status_code == 200

    response = client.get(f"{api_prefix}/elara/README")
    assert response.status_code == 200


def test_scheme_host_overrides():
    settings = typing.cast(
        config.Settings, SettingsFactory(host_scheme_override="https:sample.com:4002")
    )
    app = create_app(settings)

    router = APIRouter(prefix="/test")

    captured_url = None

    @router.get("/verify_url_for")
    def verify_url_for(request: Request):
        nonlocal captured_url
        captured_url = request.url_for("verify_url_for")
        return {}

    app.include_router(router)

    client = TestClient(app)

    response = client.get(f"/test/verify_url_for")
    assert response.status_code == 200

    assert captured_url == "https://sample.com:4002/test/verify_url_for"
