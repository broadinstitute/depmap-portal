from flask import url_for


def test_view_compound_dashboard(populated_db):
    with populated_db.app.test_client() as c:
        r = c.get(url_for("compound_dashboard.view_compound_dashboard"))
        assert r.status_code == 200, r.status_code
