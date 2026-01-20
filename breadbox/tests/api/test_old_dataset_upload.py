import os
import json
import uuid
import numpy as np
import pandas as pd

from breadbox.crud.dimension_types import get_dimension_type
from ..utils import assert_status_not_ok, assert_status_ok, assert_task_failure


from breadbox.db.session import SessionWithUser
from breadbox.models.dataset import (
    AnnotationType,
    DatasetFeature,
    DatasetSample,
    Dataset,
    Dimension,
    MatrixDataset,
    TabularDataset,
    TabularColumn,
    TabularCell,
    ValueType,
)
from fastapi.testclient import TestClient
from breadbox.api.dependencies import get_dataset
from breadbox.io.filestore_crud import get_slice
from breadbox.models.dataset import DimensionSearchIndex
from breadbox.service.search import populate_search_index_after_update

from breadbox.models.dataset import PropertyToIndex
from breadbox.schemas.dataset import ColumnMetadata

from tests import factories
from breadbox.config import Settings
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

    r = client.post(
        "/datasets/",
        data={
            "name": "a dataset",
            "units": "a unit",
            "feature_type": "other_feature",
            "sample_type": "other_sample",
            "data_type": "User upload",
            "is_transient": "False",
            "group_id": public_group.id,
            "value_type": "continuous",
        },
        files={
            "data_file": (
                "data.csv",
                factories.continuous_matrix_csv_file(),
                "text/csv",
            ),
        },
        headers={"X-Forwarded-User": "anyone"},
    )

    assert_task_failure(r, status_code=403)


def test_add_dataset_nonexistent_group(
    client: TestClient, minimal_db, mock_celery, settings
):
    fake_group_id = str(uuid.uuid4())
    factories.feature_type(minimal_db, settings.default_user, "other_feature")
    factories.sample_type(minimal_db, settings.default_user, "other_sample")

    r = client.post(
        "/datasets/",
        data={
            "name": "a dataset",
            "units": "a unit",
            "feature_type": "other_feature",
            "sample_type": "other_sample",
            "data_type": "User upload",
            "is_transient": "False",
            "group_id": fake_group_id,
            "value_type": "continuous",
        },
        files={
            "data_file": (
                "data.csv",
                factories.continuous_matrix_csv_file(),
                "text/csv",
            ),
        },
        headers={"X-Forwarded-User": "anyone"},
    )

    assert_task_failure(r, status_code=404)


def test_add_categorical_incorrect_value_type(
    client: TestClient, private_group: Dict, mock_celery
):
    # Incorrect value type for categorical values
    r = client.post(
        "/datasets/?allowed_values=Hi&allowed_values=Bye",
        data={
            "name": "a dataset",
            "units": "a unit",
            "feature_type": "generic",
            "sample_type": "depmap_model",
            "data_type": "User upload",
            "is_transient": "False",
            "group_id": private_group["id"],
            "value_type": "continuous",
        },
        files={
            "data_file": (
                "data.csv",
                factories.matrix_csv_data_file_with_values(["Hi", "Bye"]),
                "text/csv",
            ),
        },
        headers={"X-Forwarded-User": "someone@private-group.com"},
    )
    assert_task_failure(r, status_code=500)

    # Value type cannot be None
    r = client.post(
        "/datasets/?allowed_values=Hi&allowed_values=Bye",
        data={
            "name": "a dataset",
            "units": "a unit",
            "feature_type": "generic",
            "sample_type": "depmap_model",
            "data_type": "User upload",
            "is_transient": "False",
            "group_id": private_group["id"],
        },
        files={
            "data_file": (
                "data.csv",
                factories.matrix_csv_data_file_with_values(["Hi", "Bye"]),
                "text/csv",
            ),
        },
        headers={"X-Forwarded-User": "someone@private-group.com"},
    )
    assert r.status_code == 422

    # Allowed values not given for categorical datasets
    r = client.post(
        "/datasets/",
        data={
            "name": "a dataset",
            "units": "a unit",
            "feature_type": "generic",
            "sample_type": "depmap_model",
            "data_type": "User upload",
            "is_transient": "False",
            "group_id": private_group["id"],
            "value_type": "categorical",
        },
        files={
            "data_file": (
                "data.csv",
                factories.matrix_csv_data_file_with_values(["Hi", "Bye"]),
                "text/csv",
            ),
        },
        headers={"X-Forwarded-User": "someone@private-group.com"},
    )
    assert_task_failure(r)

    incorrect_values_dataset = client.post(
        "/datasets/?allowed_values=Hi&allowed_values=Bye",
        data={
            "name": "a dataset",
            "units": "a unit",
            "feature_type": "generic",
            "sample_type": "depmap_model",
            "data_type": "User upload",
            "is_transient": "False",
            "group_id": private_group["id"],
            "value_type": "categorical",
        },
        files={
            "data_file": (
                "data.csv",
                factories.matrix_csv_data_file_with_values(
                    ["Hi", "bi"]
                ),  # Not in allowed values
                "text/csv",
            ),
        },
        headers={"X-Forwarded-User": "someone@private-group.com"},
    )
    incorrect_values_dataset_response = incorrect_values_dataset.json()
    # NOTE: Celery task returning 200 for job completion but state should be failed
    assert incorrect_values_dataset.status_code == 200
    assert incorrect_values_dataset_response["state"] == "FAILURE"

    mixed_case_dataset = client.post(
        "/datasets/?allowed_values=Hi&allowed_values=Bye",
        data={
            "name": "a dataset",
            "units": "a unit",
            "feature_type": "generic",
            "sample_type": "depmap_model",
            "data_type": "User upload",
            "is_transient": "False",
            "group_id": private_group["id"],
            "value_type": "categorical",
        },
        files={
            "data_file": (
                "data.csv",
                factories.matrix_csv_data_file_with_values(
                    ["Hi", "bye"]
                ),  # Not in allowed values
                "text/csv",
            ),
        },
        headers={"X-Forwarded-User": "someone@private-group.com"},
    )
    assert_status_ok(mixed_case_dataset)


def test_add_categorical_dataset_repeated_allowed_values(
    client: TestClient, minimal_db, private_group: Dict, mock_celery
):
    r = client.post(
        "/datasets/?allowed_values=Thing1&allowed_values=Thing2&allowed_values=Thing1&allowed_values=Thing3",
        data={
            "name": "a dataset",
            "units": "a unit",
            "feature_type": "generic",
            "sample_type": "depmap_model",
            "data_type": "User upload",
            "is_transient": "False",
            "group_id": private_group["id"],
            "value_type": "categorical",
        },
        files={
            "data_file": (
                "data.csv",
                factories.matrix_csv_data_file_with_values(),
                "text/csv",
            ),
        },
        headers={"X-Forwarded-User": "someone@private-group.com"},
    )

    assert_status_ok(r)
    assert r.status_code == 200
    result = r.json()
    dataset_id = result["result"]["datasetId"]
    added_dataset = get_dataset(dataset_id, minimal_db, "someone@private-group.com")
    assert len(added_dataset.allowed_values) == 3 and set(
        added_dataset.allowed_values
    ) == {"Thing1", "Thing2", "Thing3",}
