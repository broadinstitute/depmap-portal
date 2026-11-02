from flask import url_for


def test_index_renders(app):
    with app.test_client() as c:
        r = c.get(url_for("resources_v3.index"))
        assert r.status_code == 200


def test_post_renders(app):
    with app.test_client() as c:
        r = c.get(url_for("resources_v3.post", post_slug="my-post"))
        assert r.status_code == 200


def test_old_query_string_url_redirects_to_post_url(app):
    with app.test_client() as c:
        r = c.get(
            url_for("resources_v3.index") + "?menu=my-menu&post=my-post",
            follow_redirects=False,
        )
        assert r.status_code == 302
        assert r.headers["Location"].endswith("/resources-v3/my-post")
