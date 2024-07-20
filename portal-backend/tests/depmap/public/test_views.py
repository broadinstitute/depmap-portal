import pytest
from flask import url_for
import os


@pytest.mark.parametrize(
    "endpoint",
    [
        ("home"),
        # ("acknowledgements"),
        ("privacy"),
        ("terms"),
    ],
)
def test_render_pages(app, endpoint):
    """
    Test that the home page renders 
    """
    with app.test_client() as c:
        r = c.get(url_for("public.{}".format(endpoint)))
        assert r.status_code == 200, r.status_code


def test_alert(app):
    message = b"this is the alert file"

    with app.test_client() as c:
        alert_path = os.path.join(app.config["WEBAPP_DATA_DIR"], "alert.html")
        assert os.path.exists(alert_path) is False

        resp = c.get()
        assert resp.status_code == 200
        assert message not in resp.data

        f = open(alert_path, "wb")
        f.write(message)
        f.close()

        resp = c.get()
        assert resp.status_code == 200
        assert message in resp.data
