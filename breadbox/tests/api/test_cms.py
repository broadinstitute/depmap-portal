import uuid
from fastapi.testclient import TestClient
from breadbox.config import Settings
from tests.utils import assert_status_ok, assert_status_not_ok


ADMIN_HEADERS = None  # set in fixtures per test
USER_HEADERS = {"X-Forwarded-User": "regular@user.com"}


def make_admin_headers(settings: Settings):
    return {"X-Forwarded-Email": settings.admin_users[0]}


class TestGetMenu:
    def test_empty_menu(self, client: TestClient, minimal_db):
        response = client.get("/cms/menu", headers=USER_HEADERS)
        assert_status_ok(response)
        assert response.json() == []

    def test_unauthenticated_uses_default_user_in_dev(
        self, client: TestClient, minimal_db
    ):
        # In dev mode, requests without auth headers use default_user and succeed
        response = client.get("/cms/menu")
        assert_status_ok(response)


class TestSetMenu:
    def test_set_menu_admin(self, client: TestClient, minimal_db, settings: Settings):
        admin_headers = make_admin_headers(settings)
        menu = [
            {
                "slug": "resources",
                "title": "Resources",
                "child_menus": [
                    {
                        "slug": "tutorials",
                        "title": "Tutorials",
                        "child_menus": [],
                        "posts": [],
                    }
                ],
                "posts": [],
            }
        ]
        response = client.post("/cms/menu", json=menu, headers=admin_headers)
        assert_status_ok(response)
        result = response.json()
        assert len(result) == 1
        assert result[0]["slug"] == "resources"
        assert result[0]["title"] == "Resources"
        assert len(result[0]["child_menus"]) == 1
        assert result[0]["child_menus"][0]["slug"] == "tutorials"

    def test_set_menu_requires_admin(self, client: TestClient, minimal_db):
        response = client.post("/cms/menu", json=[], headers=USER_HEADERS)
        assert response.status_code == 403

    def test_set_menu_replaces_existing(
        self, client: TestClient, minimal_db, settings: Settings
    ):
        admin_headers = make_admin_headers(settings)
        menu_v1 = [{"slug": "old", "title": "Old", "child_menus": [], "posts": []}]
        client.post("/cms/menu", json=menu_v1, headers=admin_headers)

        menu_v2 = [{"slug": "new", "title": "New", "child_menus": [], "posts": []}]
        client.post("/cms/menu", json=menu_v2, headers=admin_headers)

        response = client.get("/cms/menu", headers=USER_HEADERS)
        result = response.json()
        assert len(result) == 1
        assert result[0]["slug"] == "new"


class TestPosts:
    def test_no_posts(self, client: TestClient, minimal_db):
        response = client.get("/cms/posts", headers=USER_HEADERS)
        assert_status_ok(response)
        assert response.json() == []

    def test_upsert_and_get_post(
        self, client: TestClient, minimal_db, settings: Settings
    ):
        admin_headers = make_admin_headers(settings)
        post_id = str(uuid.uuid4())
        post = {
            "slug": "getting-started",
            "title": "Getting Started",
            "content": "# Hello\nWelcome!",
            "content_hash": "abc123",
        }

        response = client.post(
            f"/cms/posts/{post_id}", json=post, headers=admin_headers
        )
        assert_status_ok(response)
        result = response.json()
        assert result["id"] == post_id
        assert result["slug"] == "getting-started"
        assert result["content"] == "# Hello\nWelcome!"

        # Get by id
        response = client.get(f"/cms/posts/{post_id}", headers=USER_HEADERS)
        assert_status_ok(response)
        assert response.json()["title"] == "Getting Started"

    def test_get_posts_without_content(
        self, client: TestClient, minimal_db, settings: Settings
    ):
        admin_headers = make_admin_headers(settings)
        post_id = str(uuid.uuid4())
        post = {
            "slug": "my-post",
            "title": "My Post",
            "content": "Long content here",
            "content_hash": "hash1",
        }
        client.post(f"/cms/posts/{post_id}", json=post, headers=admin_headers)

        response = client.get("/cms/posts", headers=USER_HEADERS)
        assert_status_ok(response)
        posts = response.json()
        assert len(posts) == 1
        assert "content" not in posts[0]

    def test_get_posts_with_content(
        self, client: TestClient, minimal_db, settings: Settings
    ):
        admin_headers = make_admin_headers(settings)
        post_id = str(uuid.uuid4())
        post = {
            "slug": "my-post",
            "title": "My Post",
            "content": "Long content here",
            "content_hash": "hash1",
        }
        client.post(f"/cms/posts/{post_id}", json=post, headers=admin_headers)

        response = client.get("/cms/posts?include_content=true", headers=USER_HEADERS)
        assert_status_ok(response)
        posts = response.json()
        assert posts[0]["content"] == "Long content here"

    def test_upsert_updates_existing(
        self, client: TestClient, minimal_db, settings: Settings
    ):
        admin_headers = make_admin_headers(settings)
        post_id = str(uuid.uuid4())
        post = {
            "slug": "my-post",
            "title": "Original",
            "content": "v1",
            "content_hash": "h1",
        }
        client.post(f"/cms/posts/{post_id}", json=post, headers=admin_headers)

        updated = {**post, "title": "Updated", "content": "v2", "content_hash": "h2"}
        client.post(f"/cms/posts/{post_id}", json=updated, headers=admin_headers)

        response = client.get(f"/cms/posts/{post_id}", headers=USER_HEADERS)
        assert response.json()["title"] == "Updated"
        assert response.json()["content"] == "v2"

    def test_delete_post(self, client: TestClient, minimal_db, settings: Settings):
        admin_headers = make_admin_headers(settings)
        post_id = str(uuid.uuid4())
        post = {
            "slug": "to-delete",
            "title": "To Delete",
            "content": "bye",
            "content_hash": "x",
        }
        client.post(f"/cms/posts/{post_id}", json=post, headers=admin_headers)

        response = client.delete(f"/cms/posts/{post_id}", headers=admin_headers)
        assert response.status_code == 204

        response = client.get(f"/cms/posts/{post_id}", headers=USER_HEADERS)
        assert response.status_code == 404

    def test_get_nonexistent_post(self, client: TestClient, minimal_db):
        response = client.get(f"/cms/posts/{uuid.uuid4()}", headers=USER_HEADERS)
        assert response.status_code == 404

    def test_write_requires_admin(self, client: TestClient, minimal_db):
        post_id = str(uuid.uuid4())
        post = {
            "slug": "s",
            "title": "t",
            "content": "c",
            "content_hash": "h",
        }
        response = client.post(f"/cms/posts/{post_id}", json=post, headers=USER_HEADERS)
        assert response.status_code == 403

    def test_delete_requires_admin(self, client: TestClient, minimal_db):
        response = client.delete(f"/cms/posts/{uuid.uuid4()}", headers=USER_HEADERS)
        assert response.status_code == 403


class TestMenuWithPosts:
    def test_menu_references_posts_by_slug(
        self, client: TestClient, minimal_db, settings: Settings
    ):
        admin_headers = make_admin_headers(settings)
        post_id = str(uuid.uuid4())
        post = {
            "slug": "intro",
            "title": "Intro",
            "content": "...",
            "content_hash": "h",
        }
        client.post(f"/cms/posts/{post_id}", json=post, headers=admin_headers)

        menu = [
            {"slug": "docs", "title": "Docs", "child_menus": [], "posts": ["intro"],}
        ]
        response = client.post("/cms/menu", json=menu, headers=admin_headers)
        assert_status_ok(response)
        result = response.json()
        assert result[0]["posts"] == ["intro"]
