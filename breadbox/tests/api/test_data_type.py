from fastapi.testclient import TestClient

from breadbox.db.session import SessionWithUser
from breadbox.models.data_type import DataType
from breadbox.models.dataset import Dataset
from tests import factories
from tests.utils import assert_status_ok, assert_status_not_ok


class TestGet:
    def test_get_data_types(self, client: TestClient, minimal_db):
        factories.data_type(minimal_db, "test")
        # make sure we can retrieve it
        response = client.get("/data_types/",)
        assert_status_ok(response)
        assert response.json() == [{"name": "User upload"}, {"name": "test"}]

    def test_get_data_type_valid_priorities(
        self, client: TestClient, minimal_db, settings
    ):
        factories.data_type(minimal_db, "test_data_type")
        factories.data_type(minimal_db, "type_2")
        factories.data_type(minimal_db, "type_3")
        # Make sure data_types not yet assigned to any datasets are included
        factories.data_type(minimal_db, "type_4")
        factories.matrix_dataset(
            minimal_db, settings, data_type="test_data_type", priority=1
        )
        factories.matrix_dataset(
            minimal_db, settings, data_type="test_data_type", priority=3
        )
        factories.matrix_dataset(minimal_db, settings, data_type="type_2", priority=1)
        factories.matrix_dataset(minimal_db, settings, data_type="type_2", priority=2)
        factories.matrix_dataset(minimal_db, settings, data_type="type_3")
        response = client.get(
            "/data_types/priorities", headers={"X-Forwarded-User": "anyone"}
        )
        assert_status_ok(response)
        assert response.json() == {
            "User upload": [],
            "test_data_type": [1, 3],
            "type_2": [1, 2],
            "type_3": [],
            "type_4": [],
        }


class TestPost:
    def test_post_data_type(self, client: TestClient, minimal_db, settings):
        admin_user = settings.admin_users[0]
        headers = {"X-Forwarded-Email": admin_user}

        response = client.post("/data_types/", data={"name": "test"}, headers=headers)
        assert_status_ok(response)
        assert response.json() == {"name": "test"}
        # make sure we can retrieve it
        assert minimal_db.query(DataType).filter_by(data_type="test").one()


class TestDelete:
    def test_delete_data_type(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        tmpdir,
        private_group,
        settings,
    ):
        admin_user = settings.admin_users[0]
        headers = {"X-Forwarded-Email": admin_user}

        factories.data_type(minimal_db, "test")
        assert minimal_db.query(DataType).filter_by(data_type="test").one()
        res1 = client.delete(f"/data_types/test", headers=headers)
        assert_status_ok(res1)
        assert (
            minimal_db.query(DataType).filter_by(data_type="test").one_or_none() is None
        )
        dataset = factories.matrix_dataset(minimal_db, settings)
        dataset_id = dataset.id
        assert minimal_db.query(Dataset).filter_by(id=dataset_id).one()
        res2 = client.delete(f"/data_types/user_upload")
        assert_status_not_ok(res2)
        assert (
            minimal_db.query(Dataset).filter_by(id=dataset_id).one_or_none() is not None
        )
