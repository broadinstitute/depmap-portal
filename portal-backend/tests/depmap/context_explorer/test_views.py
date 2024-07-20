from flask import url_for


def test_view_context_explorer(populated_db):
    with populated_db.app.test_client() as c:
        r = c.get(url_for("context_explorer.view_context_explorer"))
        assert r.status_code == 200, r.status_code
