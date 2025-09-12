from contextlib import contextmanager
from fastapi.testclient import TestClient
from breadbox.config import Settings
from breadbox.compute import dataset_tasks
from breadbox.crud.access_control import PUBLIC_GROUP_ID
from breadbox.crud.group import delete_group_entry, add_group, add_group_entry
from breadbox.schemas.group import GroupEntryIn, GroupIn, AccessType
from ..utils import assert_status_ok, assert_status_not_ok

from tests import factories


class TestGet:
    def test_empty_db(self, client: TestClient):
        response = client.get("/groups/", headers={"X-Forwarded-User": "anyone"})
        assert_status_ok(response)
        assert response.json() == []

    def test_minimal_db(self, client: TestClient, minimal_db):
        response = client.get("/groups/", headers={"X-Forwarded-User": "anyone"})
        assert_status_ok(response)
        groups = response.json()
        assert len(groups) == 1
        public_group = groups[0]
        assert public_group["name"] == "Public"

    def test_minimal_db_user_in_access_group(
        self, client: TestClient, minimal_db, private_group
    ):
        response = client.get(
            "/groups/", headers={"X-Forwarded-User": "user@private-group.com"}
        )
        assert_status_ok(response)
        groups = response.json()
        assert len(groups) == 2

    def test_write_access_query(self, client: TestClient, minimal_db, private_group):
        response = client.get(
            "/groups/?write_access=True",
            headers={"X-Forwarded-User": "user@private-group.com"},
        )
        assert_status_ok(response)
        groups = response.json()
        assert len(groups) == 1
        private = groups[0]
        assert private["name"] == "Private"

    def test_get_group(
        self, client: TestClient, settings: Settings, minimal_db, private_group
    ):
        admin_user = settings.admin_users[0]
        admin_headers = {"X-Forwarded-Email": admin_user}
        admin_groups = client.get("/groups/", headers=admin_headers).json()
        public_group = None
        private_group = None
        for group in admin_groups:
            if group["name"] == "Public":
                public_group = group
            if group["name"] == "Private":
                private_group = group
        assert public_group and private_group
        r_public = client.get(
            f"/groups/{public_group['id']}", headers={"X-Forwarded-User": "anyone"}
        )
        assert_status_ok(r_public)
        public = r_public.json()
        assert (
            public["id"] == public_group["id"]
            and public["name"] == public_group["name"]
        )
        r_private = client.get(
            f"/groups/{private_group['id']}", headers={"X-Forwarded-User": "anyone"}
        )
        assert_status_not_ok(r_private)

    def test_get_group_access_controls(
        self, client: TestClient, settings: Settings, minimal_db
    ):
        """
        Admins have the ability to see all private groups, but should not
        be able to see datasets belonging to groups they're not in. 
        """
        admin_user = settings.admin_users[0]
        private_group_user = "user@IhaveAccess.org"
        unknown_user = "NoAccessHere@noaccess.org"

        # Make the private group
        private_group = add_group(
            minimal_db, admin_user, group_in=GroupIn(name="private_group")
        )
        # Find the admin's group entry
        # (they were set sas the owner by default because they created the group)
        admin_group_entry = private_group.group_entries[0]
        owner_group_entry = GroupEntryIn(
            email=private_group_user, access_type=AccessType.owner, exact_match=True,
        )
        add_group_entry(minimal_db, admin_user, private_group, owner_group_entry)

        private_dataset = factories.matrix_dataset(
            minimal_db, settings, group=private_group.id
        )

        public_dataset = factories.matrix_dataset(
            minimal_db, settings, group=PUBLIC_GROUP_ID,
        )

        # When the admin is a member of the private group, they should have access to the datasets
        # They should also have access to datasets in public groups.
        response = client.get(f"/groups/", headers={"X-Forwarded-User": admin_user})
        assert_status_ok(response)
        response_groups = response.json()
        assert len(response_groups) == 2  # public and private groups
        for group in response_groups:
            assert group.get("datasets") is not None
            assert len(group.get("datasets")) == 1

        # When the admin is removed from the group, they should still be able to see the group
        # but not any datasets within the group.
        delete_group_entry(minimal_db, admin_user, group_entry_id=admin_group_entry.id)
        minimal_db.commit()
        response = client.get(
            f"/groups/{private_group.id}", headers={"X-Forwarded-User": admin_user}
        )
        assert_status_ok(response)
        response_group = response.json()
        assert response_group.get("datasets") is None

        # Non-admin users who are a part of the group should have dataset access
        response = client.get(
            f"/groups/{private_group.id}",
            headers={"X-Forwarded-User": private_group_user},
        )
        assert_status_ok(response)
        response_group = response.json()
        assert response_group.get("datasets") is not None
        assert len(response_group.get("datasets")) == 1

        # Other users shouldn't have access to the group at all
        response = client.get(
            f"/groups/{private_group.id}", headers={"X-Forwarded-User": unknown_user}
        )
        assert response.status_code == 404


class TestPost:
    def test_add_group_entry(self, client: TestClient, settings: Settings, minimal_db):
        admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}
        # Make group
        post_group = client.post(
            "/groups/", json={"name": "TestAdd"}, headers=admin_headers
        )
        owner_group = post_group.json()
        assert_status_ok(post_group)

        # Get group
        get_group = client.get(f"/groups/{owner_group['id']}", headers=admin_headers)
        assert_status_ok(get_group)
        group = get_group.json()
        assert owner_group["id"] == group["id"]
        assert len(group["group_entries"]) == 1
        assert group["group_entries"][0]["access_type"] == "owner"

        # add group entres
        post_entry_1 = client.post(
            f"/groups/{owner_group['id']}/addAccess",
            json={
                "email": "random@email.com",
                "access_type": "read",
                "exact_match": True,
            },
            headers=admin_headers,
        )
        assert_status_ok(post_entry_1)
        post_entry_1_copy = client.post(
            f"/groups/{owner_group['id']}/addAccess",
            json={
                "email": "random@email.com",
                "access_type": "read",
                "exact_match": True,
            },
            headers=admin_headers,
        )
        assert_status_ok(post_entry_1_copy)

        # this should fail because the email doesn't start with '@'
        post_suffix_match_entry = client.post(
            f"/groups/{owner_group['id']}/addAccess",
            json={"email": "email.com", "access_type": "read", "exact_match": False,},
            headers=admin_headers,
        )
        assert_status_not_ok(post_suffix_match_entry)

        # this should succeed because now that email starts with '@'
        post_suffix_match_entry = client.post(
            f"/groups/{owner_group['id']}/addAccess",
            json={"email": "@email.com", "access_type": "read", "exact_match": False,},
            headers=admin_headers,
        )
        assert_status_ok(post_suffix_match_entry)


class TestDelete:
    def test_delete_group(
        self,
        client: TestClient,
        settings: Settings,
        minimal_db,
        monkeypatch,
        celery_app,
    ):
        @contextmanager
        def mock_db_context(user, **kwargs):
            yield minimal_db

        def get_test_settings():
            return settings

        # The endpoint uses celery, and needs monkeypatching to replace db_context and get_settings,
        # which are not passed in as params due to the limits of redis serialization.
        monkeypatch.setattr(dataset_tasks, "db_context", mock_db_context)
        monkeypatch.setattr(dataset_tasks, "get_settings", get_test_settings)
        monkeypatch.setattr(
            dataset_tasks,
            "run_upload_dataset",
            celery_app.task(bind=True)(dataset_tasks.run_upload_dataset),
        )

        nongroup_user_header = {"X-Forwarded-User": "random@group.com"}
        admin_user = settings.admin_users[0]
        admin_headers = {"X-Forwarded-Email": admin_user}
        # Make group. NOTE: only admin can create group
        r_post = client.post(
            "/groups/", json={"name": "TestRemove"}, headers=admin_headers
        )
        owner_group = r_post.json()
        assert_status_ok(r_post)
        # Ensure group created
        r_get = client.get("/groups/?write_access=True", headers=admin_headers)
        assert_status_ok(r_get)
        owner_groups = r_get.json()
        assert len(owner_groups) == 2
        assert owner_group in owner_groups

        # Add dataset to group
        with open(f"tests/sample_data/chronos_combined_score.csv", "rb") as f:
            post_data = client.post(
                "/datasets/",
                data={
                    "name": "a dataset",
                    "units": "a unit",
                    "feature_type": "generic",
                    "sample_type": "depmap_model",
                    "data_type": "User upload",
                    "is_transient": "false",
                    "group_id": owner_group["id"],
                    "value_type": "continuous",
                },
                files={"data_file": ("data.csv", f, "text/csv",),},
                headers=admin_headers,
            )
        assert_status_ok(post_data)
        dataset = post_data.json()
        minimal_db.commit()

        # Test group deleted for nongroup member
        nongroup_user_delete = client.delete(
            f"/groups/{owner_group['id']}", headers=nongroup_user_header
        )
        assert_status_not_ok(nongroup_user_delete)
        # Test group delete should not be successful if there are datasets
        owner_delete = client.delete(
            f"/groups/{owner_group['id']}", headers=admin_headers
        )
        assert_status_not_ok(owner_delete)
        r_get = client.get("/groups/?write_access=True", headers=admin_headers)
        assert_status_ok(r_get)
        owner_groups = r_get.json()
        assert len(owner_groups) == 2
        # Test successful group delete
        r = client.delete(
            f"/datasets/{dataset['result']['datasetId']}", headers=admin_headers,
        )
        assert_status_ok(r)
        owner_delete = client.delete(
            f"/groups/{owner_group['id']}", headers=admin_headers
        )
        assert_status_ok(owner_delete)
        r_get = client.get("/groups/?write_access=True", headers=admin_headers)
        assert_status_ok(r_get)
        owner_groups = r_get.json()
        assert len(owner_groups) == 1

    def test_delete_entry(self, client: TestClient, settings: Settings, minimal_db):
        admin_user = settings.admin_users[0]
        admin_headers = {"X-Forwarded-Email": admin_user}
        # Make group
        post_group = client.post(
            "/groups/", json={"name": "TestRemove"}, headers=admin_headers
        )
        owner_group = post_group.json()
        assert_status_ok(post_group)

        # Get group
        get_group = client.get(f"/groups/{owner_group['id']}", headers=admin_headers)
        assert_status_ok(get_group)
        group = get_group.json()
        assert owner_group["id"] == group["id"]
        assert len(group["group_entries"]) == 1
        admin_entry = group["group_entries"][0]

        # add group entres
        read_user_header = {"X-Forwarded-User": "random@group.com"}
        post_read_entry = client.post(
            f"/groups/{owner_group['id']}/addAccess",
            json={
                "email": "random@group.com",
                "access_type": "read",
                "exact_match": True,
            },
            headers=admin_headers,
        )
        assert_status_ok(post_read_entry)
        read_only_user_entry = post_read_entry.json()
        group = client.get(f"/groups/{owner_group['id']}", headers=admin_headers).json()
        assert len(group["group_entries"]) == 2

        write_user_header = {"X-Forwarded-User": "writer@group.com"}
        post_write_entry = client.post(
            f"/groups/{owner_group['id']}/addAccess",
            json={
                "email": "writer@group.com",
                "access_type": "write",
                "exact_match": True,
            },
            headers=admin_headers,
        )
        assert_status_ok(post_write_entry)
        write_only_user_entry = post_write_entry.json()
        group = client.get(f"/groups/{owner_group['id']}", headers=admin_headers).json()
        assert len(group["group_entries"]) == 3

        # Delete group entry
        # Delete group entry if user does not have write access
        def read_only_delete():
            reader_delete = client.delete(
                f"/groups/{read_only_user_entry['id']}/removeAccess",
                headers=read_user_header,
            )
            assert reader_delete.status_code == 403
            group = client.get(
                f"/groups/{owner_group['id']}", headers=admin_headers
            ).json()
            assert len(group["group_entries"]) == 3

        read_only_delete()

        # Delete group entry if user has write access
        write_delete = client.delete(
            f"/groups/{read_only_user_entry['id']}/removeAccess",
            headers=write_user_header,
        )
        assert_status_ok(write_delete)
        group = client.get(f"/groups/{owner_group['id']}", headers=admin_headers).json()
        assert len(group["group_entries"]) == 2

        # Write only user that is not admin cannot delete admin entry
        nonadmin_delete = client.delete(
            f"/groups/{admin_entry['id']}/removeAccess", headers=write_user_header
        )
        assert nonadmin_delete.status_code == 403
        group = client.get(f"/groups/{owner_group['id']}", headers=admin_headers).json()
        assert len(group["group_entries"]) == 2

        # Delete admin group entry if user is admin
        post_owner_entry = client.post(
            f"/groups/{owner_group['id']}/addAccess",
            json={
                "email": "owner2@group.com",
                "access_type": "owner",
                "exact_match": True,
            },
            headers=admin_headers,
        )
        assert_status_ok(post_owner_entry)
        group = client.get(f"/groups/{owner_group['id']}", headers=admin_headers).json()
        assert len(group["group_entries"]) == 3
        authorized_delete = client.delete(
            f"/groups/{admin_entry['id']}/removeAccess", headers=admin_headers
        )
        assert_status_ok(authorized_delete)
        # This request also checks that admin still has access to group even though their entry is deleted
        group = client.get(f"/groups/{owner_group['id']}", headers=admin_headers).json()
        assert len(group["group_entries"]) == 2
        assert write_only_user_entry["id"] == group["group_entries"][0]["id"]
