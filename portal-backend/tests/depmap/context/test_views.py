from flask import url_for
from tests.factories import ContextFactory


def test_render_view_context(empty_db_mock_downloads):
    """
    Test that the cell line page for every cell line in the db renders 
    """
    context = ContextFactory()
    empty_db_mock_downloads.session.flush()

    with empty_db_mock_downloads.app.test_client() as c:
        r = c.get(url_for("context.view_context", context_name=context.name))
        assert r.status_code == 200, r.status_code
