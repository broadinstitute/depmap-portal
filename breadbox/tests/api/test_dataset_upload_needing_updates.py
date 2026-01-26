import uuid
from ..utils import assert_status_not_ok, assert_task_failure, assert_task_success


from breadbox.db.session import SessionWithUser
from fastapi.testclient import TestClient

from tests import factories
from typing import Dict
from ..utils import upload_and_get_file_ids


def test_add_dataset_no_write_access(
    client: TestClient,
    minimal_db: SessionWithUser,
    mock_celery,
    public_group,
    settings,
):
    factories.feature_type(minimal_db, settings.default_user, "other_feature")
    factories.sample_type(minimal_db, settings.default_user, "other_sample")

    file = factories.continuous_matrix_csv_file()
    file_ids, expected_md5 = upload_and_get_file_ids(client, file)

    r = client.post(
        "/dataset-v2/",
        json={
            "format": "matrix",
            "name": "a dataset",
            "units": "a unit",
            "feature_type": "other_feature",
            "sample_type": "other_sample",
            "data_type": "User upload",
            "file_ids": file_ids,
            "dataset_md5": expected_md5,
            "is_transient": False,
            "group_id": public_group.id,
            "value_type": "continuous",
            "allowed_values": None,
        },
        headers={"X-Forwarded-User": "anyone"},
    )

    assert_task_failure(r)


def test_add_dataset_nonexistent_group(
    client: TestClient, minimal_db, mock_celery, settings
):
    fake_group_id = str(uuid.uuid4())
    factories.feature_type(minimal_db, settings.default_user, "other_feature")
    factories.sample_type(minimal_db, settings.default_user, "other_sample")

    file = factories.continuous_matrix_csv_file()
    file_ids, expected_md5 = upload_and_get_file_ids(client, file)

    r = client.post(
        "/dataset-v2/",
        json={
            "format": "matrix",
            "name": "a dataset",
            "units": "a unit",
            "feature_type": "other_feature",
            "sample_type": "other_sample",
            "data_type": "User upload",
            "file_ids": file_ids,
            "dataset_md5": expected_md5,
            "is_transient": False,
            "group_id": fake_group_id,
            "value_type": "continuous",
            "allowed_values": None,
        },
        headers={"X-Forwarded-User": "anyone"},
    )

    assert_task_failure(r)


def test_add_categorical_incorrect_value_type(
    client: TestClient, private_group: Dict, mock_celery
):
    # Incorrect value type for categorical values
    file = factories.matrix_csv_data_file_with_values(["Hi", "Bye"])
    file_ids, expected_md5 = upload_and_get_file_ids(client, file)

    r = client.post(
        "/dataset-v2/",
        json={
            "format": "matrix",
            "name": "a dataset",
            "units": "a unit",
            "feature_type": "generic",
            "sample_type": "depmap_model",
            "data_type": "User upload",
            "file_ids": file_ids,
            "dataset_md5": expected_md5,
            "is_transient": False,
            "group_id": private_group["id"],
            "value_type": "continuous",
        },
        headers={"X-Forwarded-User": "someone@private-group.com"},
    )
    assert_task_failure(r, message_contains="Unable to parse string")

    # Value type cannot be None
    file = factories.matrix_csv_data_file_with_values(["Hi", "Bye"])
    file_ids, expected_md5 = upload_and_get_file_ids(client, file)

    r = client.post(
        "/dataset-v2/",
        json={
            "format": "matrix",
            "name": "a dataset",
            "units": "a unit",
            "feature_type": "generic",
            "sample_type": "depmap_model",
            "data_type": "User upload",
            "file_ids": file_ids,
            "dataset_md5": expected_md5,
            "is_transient": False,
            "group_id": private_group["id"],
            "allowed_values": ["Hi", "Bye"],
        },
        headers={"X-Forwarded-User": "someone@private-group.com"},
    )
    assert r.status_code == 422

    # Allowed values not given for categorical datasets
    file = factories.matrix_csv_data_file_with_values(["Hi", "Bye"])
    file_ids, expected_md5 = upload_and_get_file_ids(client, file)

    r = client.post(
        "/dataset-v2/",
        json={
            "format": "matrix",
            "name": "a dataset",
            "units": "a unit",
            "feature_type": "generic",
            "sample_type": "depmap_model",
            "data_type": "User upload",
            "file_ids": file_ids,
            "dataset_md5": expected_md5,
            "is_transient": False,
            "group_id": private_group["id"],
            "value_type": "categorical",
            "allowed_values": None,
        },
        headers={"X-Forwarded-User": "someone@private-group.com"},
    )
    assert r.status_code == 422

    file = factories.matrix_csv_data_file_with_values(["Hi", "bi"])
    file_ids, expected_md5 = upload_and_get_file_ids(client, file)

    incorrect_values_dataset = client.post(
        "/dataset-v2/",
        json={
            "format": "matrix",
            "name": "a dataset",
            "units": "a unit",
            "feature_type": "generic",
            "sample_type": "depmap_model",
            "data_type": "User upload",
            "file_ids": file_ids,
            "dataset_md5": expected_md5,
            "is_transient": False,
            "group_id": private_group["id"],
            "value_type": "categorical",
            "allowed_values": ["Hi", "Bye"],
        },
        headers={"X-Forwarded-User": "someone@private-group.com"},
    )
    assert_task_failure(incorrect_values_dataset)

    file = factories.matrix_csv_data_file_with_values(["Hi", "bye"])
    file_ids, expected_md5 = upload_and_get_file_ids(client, file)

    mixed_case_dataset = client.post(
        "/dataset-v2/",
        json={
            "format": "matrix",
            "name": "a dataset",
            "units": "a unit",
            "feature_type": "generic",
            "sample_type": "depmap_model",
            "data_type": "User upload",
            "file_ids": file_ids,
            "dataset_md5": expected_md5,
            "is_transient": False,
            "group_id": private_group["id"],
            "value_type": "categorical",
            "allowed_values": ["Hi", "Bye"],
        },
        headers={"X-Forwarded-User": "someone@private-group.com"},
    )
    assert_task_success(mixed_case_dataset)


def test_add_categorical_dataset_repeated_allowed_values(
    client: TestClient, minimal_db, private_group: Dict, mock_celery
):
    file = factories.matrix_csv_data_file_with_values()
    file_ids, expected_md5 = upload_and_get_file_ids(client, file)

    r = client.post(
        "/dataset-v2/",
        json={
            "format": "matrix",
            "name": "a dataset",
            "units": "a unit",
            "feature_type": "generic",
            "sample_type": "depmap_model",
            "data_type": "User upload",
            "file_ids": file_ids,
            "dataset_md5": expected_md5,
            "is_transient": False,
            "group_id": private_group["id"],
            "value_type": "categorical",
            "allowed_values": ["Thing1", "Thing2", "Thing1", "Thing3"],
        },
        headers={"X-Forwarded-User": "someone@private-group.com"},
    )

    assert_status_not_ok(r)
