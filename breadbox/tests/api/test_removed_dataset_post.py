import os
import json
import uuid
import numpy as np
import pandas as pd

from breadbox.crud.dimension_types import get_dimension_type
from ..factories import feature_type
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

import pytest


@pytest.mark.skip("post method removed")
class TestPost:
    def test_add_dataset(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        mock_celery,
        private_group: Dict,
    ):
        user = "someone@private-group.com"
        headers = {"X-Forwarded-User": user}
        group_id = private_group["id"]

        response = client.post(
            "/datasets/",
            data={
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "is_transient": "False",
                "group_id": group_id,
                "value_type": "continuous",
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.continuous_matrix_csv_file(),
                    "text/csv",
                ),
            },
            headers=headers,
        )

        assert_status_ok(response)
        dataset_id = response.json()["result"]["datasetId"]
        dataset = minimal_db.query(Dataset).filter(Dataset.id == dataset_id).one()
        assert dataset.upload_date is not None
        # Test that feature and sample dimensions were added
        feature_indexes = minimal_db.query(DatasetFeature).all()
        sample_indexes = minimal_db.query(DatasetSample).all()
        assert len(feature_indexes) == 3  # Number of feaures should be 3
        assert len(sample_indexes) == 2  # Number of feaures should be 2

    def test_add_dataset_no_write_access(
        self,
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
        self, client: TestClient, minimal_db, mock_celery, settings
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

    def test_add_categorical_dataset(
        self, client: TestClient, minimal_db, private_group: Dict, mock_celery
    ):
        user = "someone@private-group.com"
        r = client.post(
            "/datasets/?allowed_values=Thing1&allowed_values=Thing2&allowed_values=Thing3",
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
            headers={"X-Forwarded-User": user},
        )

        assert_status_ok(r)
        assert r.status_code == 200
        result_dataset = r.json()["result"]["dataset"]
        feature_indexes = minimal_db.query(DatasetFeature).all()
        sample_indexes = minimal_db.query(DatasetSample).all()
        assert len(feature_indexes) == 3  # Number of feaures should be 3
        assert len(sample_indexes) == 2  # Number of samples should be 2
        categorical_dataset = (
            minimal_db.query(MatrixDataset)
            .filter(MatrixDataset.id == result_dataset["id"])
            .one()
        )
        assert categorical_dataset
        assert categorical_dataset.value_type == ValueType.categorical

    def test_add_categorical_and_binary_dataset(
        self, client: TestClient, minimal_db, private_group: Dict, mock_celery
    ):
        user = "someone@private-group.com"
        # Two non boolean values should be considered categorical not binary
        r1 = client.post(
            "/datasets/?allowed_values=True&allowed_values=False",
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
                    factories.matrix_csv_data_file_with_values([True, False]),
                    "text/csv",
                ),
            },
            headers={"X-Forwarded-User": user},
        )

        assert_status_ok(r1)
        assert r1.status_code == 200
        dataset_response = r1.json()["result"]["dataset"]
        dataset: MatrixDataset = (
            minimal_db.query(MatrixDataset)
            .filter(MatrixDataset.id == dataset_response["id"])
            .one()
        )
        assert dataset is not None
        assert dataset.value_type == ValueType.categorical

        # Two non boolean values should be considered categorical not binary
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

        assert_status_ok(r)
        assert r.status_code == 200
        result_dataset = r.json()["result"]["dataset"]
        dataset: MatrixDataset = (
            minimal_db.query(MatrixDataset)
            .filter(MatrixDataset.id == result_dataset["id"])
            .one()
        )
        assert dataset is not None
        assert dataset.value_type == ValueType.categorical

        # Dataset only has two values but allowed values is more than 2
        r2 = client.post(
            "/datasets/?allowed_values=Hi&allowed_values=Bye&allowed_values=Unknown",
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
        assert_status_ok(r2) and r2.status_code == 200
        result2_dataset = r2.json()["result"]["dataset"]
        dataset: MatrixDataset = (
            minimal_db.query(MatrixDataset)
            .filter(MatrixDataset.id == result2_dataset["id"])
            .one()
        )
        assert dataset is not None
        assert dataset.value_type == ValueType.categorical

    def test_add_categorical_incorrect_value_type(
        self, client: TestClient, private_group: Dict, mock_celery
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
        self, client: TestClient, minimal_db, private_group: Dict, mock_celery
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

    def test_add_dataset_with_missing_values(
        self, client: TestClient, minimal_db, private_group: Dict, mock_celery, settings
    ):
        user = "someone@private-group.com"
        r_continuous = client.post(
            "/datasets/",
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
                    factories.matrix_csv_data_file_with_values(
                        values=[1, 2, 3, np.NaN]
                    ),
                    "text/csv",
                ),
            },
            headers={"X-Forwarded-User": user},
        )

        assert_status_ok(r_continuous)
        assert r_continuous.status_code == 200
        result_dataset = r_continuous.json()["result"]["dataset"]

        assert minimal_db.query(Dataset).filter_by(id=result_dataset["id"]).one()
        assert (
            len(
                minimal_db.query(Dimension)
                .filter_by(dataset_id=result_dataset["id"])
                .all()
            )
            == 5
        )  # 3 features + 2 samples

        r_categorical = client.post(
            "/datasets/?allowed_values=Thing1&allowed_values=Thing2&allowed_values=Thing3",
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
                        values=["Thing1", "Thing2", "Thing3", np.NaN]
                    ),
                    "text/csv",
                ),
            },
            headers={"X-Forwarded-User": "someone@private-group.com"},
        )

        assert_status_ok(r_categorical)
        assert r_categorical.status_code == 200
        result_dataset = r_categorical.json()["result"]["dataset"]

        assert minimal_db.query(Dataset).filter_by(id=result_dataset["id"]).one()
        assert (
            len(
                minimal_db.query(Dimension)
                .filter_by(dataset_id=result_dataset["id"])
                .all()
            )
            == 5
        )  # 3 features + 2 samples
        categorical_dataset = (
            minimal_db.query(MatrixDataset)
            .filter(MatrixDataset.value_type == ValueType.categorical)
            .one()
        )
        feature_indices = [
            tup[0]
            for tup in minimal_db.query(DatasetFeature.index)
            .filter(DatasetFeature.dataset_id == categorical_dataset.id)
            .order_by(DatasetFeature.index)
            .all()
        ]
        df = get_slice(
            categorical_dataset, feature_indices, None, settings.filestore_location
        )
        assert df.loc["ACH-2"]["A"] == None

    def test_add_dataset_if_valid_metadata_mappings(
        self,
        client: TestClient,
        minimal_db,
        private_group: Dict,
        settings,
        mock_celery,
    ):
        admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}

        r_feature_metadata = client.post(
            "/types/feature",
            data={
                "name": "gene",
                "id_column": "entrez_id",
                "annotation_type_mapping": json.dumps(
                    {
                        "annotation_type_mapping": {
                            "label": "text",
                            "attr2": "continuous",
                            "entrez_id": "text",
                        }
                    }
                ),
                "taiga_id": "test-taiga.1",
            },
            files={
                "metadata_file": (
                    "feature_metadata.csv",
                    factories.tabular_csv_data_file(
                        cols=["label", "entrez_id", "attr2"],
                        row_values=[["a", "A", 1.0], ["b", "B", 2.0]],
                    ),
                    "text/csv",
                )
            },
            headers=admin_headers,
        )
        assert r_feature_metadata.status_code == 200, r_feature_metadata.content
        r_sample_metadata = client.post(
            "/types/sample",
            data={
                "name": "sample",
                "id_column": "sample_id",
                "annotation_type_mapping": json.dumps(
                    {
                        "annotation_type_mapping": {
                            "attr1": "text",
                            "attr2": "continuous",
                            "sample_id": "text",
                            "label": "text",
                        }
                    }
                ),
            },
            files={
                "metadata_file": (
                    "sample_metadata.csv",
                    factories.tabular_csv_data_file(
                        cols=["attr1", "sample_id", "attr2", "label"],
                        row_values=[
                            ["a", "ACH-1", 1.0, "cell line 1"],
                            ["b", "ACH-2", 2.0, "cell line 2"],
                        ],
                    ),
                    "text/csv",
                )
            },
            headers=admin_headers,
        )
        assert r_sample_metadata.status_code == 200, r_sample_metadata.content
        # If no metadata given, validate against feature type and sample type metadata. If not found, provide warning
        r_dataset_no_metadata_for_feature = client.post(
            "/datasets/",
            data={
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "gene",  # Metadata doesn't have feature 'C'
                "sample_type": "sample",
                "data_type": "User upload",
                "is_transient": "False",
                "group_id": private_group["id"],
                "value_type": "continuous",
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.continuous_matrix_csv_file(),
                    "text/csv",
                )
            },  # Features: 'A', 'B', 'C'
            headers=admin_headers,
        )
        # Has warning
        assert_status_ok(r_dataset_no_metadata_for_feature), (
            r_dataset_no_metadata_for_feature.status_code == 200
        )
        assert r_dataset_no_metadata_for_feature.json()["result"]["warnings"] == [
            "Features: ['C'] not in gene metadata. Consider updating your feature type metadata!"
        ]

    def test_add_dataset_with_metadata(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        mock_celery,
        private_group: Dict,
    ):
        headers = {"X-Forwarded-User": "someone@private-group.com"}

        dataset_simple_metadata = client.post(
            "/datasets/",
            data={
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "is_transient": "False",
                "group_id": private_group["id"],
                "value_type": "continuous",
                "dataset_metadata": json.dumps(
                    {"dataset_metadata": {"test": "value", "another": "value"}}
                ),
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.continuous_matrix_csv_file(),
                    "text/csv",
                ),
            },
            headers=headers,
        )

        assert_status_ok(dataset_simple_metadata)

        assert dataset_simple_metadata.json()["result"]["dataset"][
            "dataset_metadata"
        ] == {"test": "value", "another": "value",}

        dataset_nested_metadata = client.post(
            "/datasets/",
            data={
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "is_transient": "False",
                "group_id": private_group["id"],
                "value_type": "continuous",
                "dataset_metadata": json.dumps(
                    {
                        "dataset_metadata": {
                            "test": "value",
                            "another": {"nested": "value"},
                        }
                    }
                ),
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.continuous_matrix_csv_file(),
                    "text/csv",
                ),
            },
            headers=headers,
        )
        assert_status_ok(dataset_nested_metadata)
        assert dataset_nested_metadata.json()["result"]["dataset"][
            "dataset_metadata"
        ] == {"test": "value", "another": {"nested": "value"}}

    def test_add_data_type_priority_datasets(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        settings: Settings,
        mock_celery,
        private_group: Dict,
    ):
        """
        priority does not need to be unique for each data type
        """
        factories.data_type(minimal_db, "test1")
        factories.data_type(minimal_db, "test2")
        test1_dataset = factories.matrix_dataset(
            minimal_db, settings, data_type="test1", priority=1
        )
        test2_dataset = factories.matrix_dataset(
            minimal_db, settings, data_type="test2", priority=1
        )

        user = "someone@private-group.com"
        r1 = client.post(
            "/datasets/",
            data={
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "test2",
                "is_transient": "False",
                "group_id": private_group["id"],
                "value_type": "continuous",
                "priority": "2",
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.continuous_matrix_csv_file(),
                    "text/csv",
                ),
            },
            headers={"X-Forwarded-User": user},
        )
        assert minimal_db.query(Dataset).filter_by(name="a dataset").one()

        # with pytest.raises(Exception):
        r2 = client.post(
            "/datasets/",
            data={  # pyright: ignore
                "name": "another dataset",
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "test2",
                "is_transient": False,
                "group_id": private_group["id"],
                "value_type": "continuous",
                "priority": 2,
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.continuous_matrix_csv_file(),
                    "text/csv",
                ),
            },
            headers={"X-Forwarded-User": "someone@private-group.com"},
        )
        assert r2.status_code == 200

    def test_get_matrix_dataset_data_by_given_id(
        self, client: TestClient, minimal_db: SessionWithUser, settings, mock_celery
    ):
        factories.sample_type(
            minimal_db, settings.admin_users[0], "model", given_ids=["ACH-1", "ACH-2"]
        )
        given_id = "dataset_given_id"
        factories.matrix_dataset(
            minimal_db,
            settings,
            feature_type=None,
            sample_type="model",
            given_id=given_id,
        )
        # TODO: Delete after deprecated endpoint is deleted
        response = client.post(f"/datasets/data/{given_id}",)
        assert_status_ok(response)
        assert response.json() == {
            "A": {"ACH-1": 0.0, "ACH-2": 3.0},
            "B": {"ACH-1": 1.0, "ACH-2": 4.0},
            "C": {"ACH-1": 2.0, "ACH-2": 5.0},
        }
        response = client.post(f"/datasets/matrix/{given_id}",)
        assert_status_ok(response)
        assert response.json() == {
            "A": {"ACH-1": 0.0, "ACH-2": 3.0},
            "B": {"ACH-1": 1.0, "ACH-2": 4.0},
            "C": {"ACH-1": 2.0, "ACH-2": 5.0},
        }

    def test_get_matrix_dataset_data_no_filters(
        self, client: TestClient, minimal_db: SessionWithUser, settings, mock_celery
    ):
        factories.sample_type(
            minimal_db, settings.admin_users[0], "model", given_ids=["ACH-1", "ACH-2"]
        )
        dataset = factories.matrix_dataset(
            minimal_db, settings, feature_type=None, sample_type="model",
        )
        # TODO: Delete after deprecated endpoint is deleted
        response = client.post(f"/datasets/data/{dataset.id}",)
        assert response.json() == {
            "A": {"ACH-1": 0.0, "ACH-2": 3.0},
            "B": {"ACH-1": 1.0, "ACH-2": 4.0},
            "C": {"ACH-1": 2.0, "ACH-2": 5.0},
        }
        response = client.post(f"/datasets/matrix/{dataset.id}",)
        assert response.json() == {
            "A": {"ACH-1": 0.0, "ACH-2": 3.0},
            "B": {"ACH-1": 1.0, "ACH-2": 4.0},
            "C": {"ACH-1": 2.0, "ACH-2": 5.0},
        }

    def test_get_matrix_dataset_data_generic_feature_type_labels(
        self, client: TestClient, minimal_db: SessionWithUser, settings, mock_celery
    ):
        factories.sample_type(
            minimal_db, settings.admin_users[0], "model", given_ids=["ACH-1", "ACH-2"]
        )
        dataset = factories.matrix_dataset(
            minimal_db, settings, feature_type=None, sample_type="model"
        )
        # TODO: Delete after deprecated endpoint is deleted
        response = client.post(
            f"/datasets/data/{dataset.id}",
            json={
                "features": ["A", "B"],
                "feature_identifier": "label",
                "samples": ["ACH-1", "ACH-2"],
                "sample_identifier": "id",
            },
        )
        assert response.json() == {
            "A": {"ACH-1": 0.0, "ACH-2": 3.0},
            "B": {"ACH-1": 1.0, "ACH-2": 4.0},
        }
        response = client.post(
            f"/datasets/matrix/{dataset.id}",
            json={
                "features": ["A", "B"],
                "feature_identifier": "label",
                "samples": ["ACH-1", "ACH-2"],
                "sample_identifier": "id",
            },
        )
        assert response.json() == {
            "A": {"ACH-1": 0.0, "ACH-2": 3.0},
            "B": {"ACH-1": 1.0, "ACH-2": 4.0},
        }

        # verify that when we fetch a feature which doesn't exist, we silently drop the invalid feature
        # TODO: Delete after deprecated endpoint is deleted
        response = client.post(
            f"/datasets/data/{dataset.id}",
            json={
                "features": ["A", "INVALID"],
                "feature_identifier": "id",
                "samples": ["ACH-1"],
                "sample_identifier": "id",
            },
        )
        assert response.status_code == 200
        assert response.json() == {
            "A": {"ACH-1": 0.0},
        }
        response = client.post(
            f"/datasets/matrix/{dataset.id}",
            json={
                "features": ["A", "INVALID"],
                "feature_identifier": "id",
                "samples": ["ACH-1"],
                "sample_identifier": "id",
            },
        )
        assert response.status_code == 200
        assert response.json() == {
            "A": {"ACH-1": 0.0},
        }

    def test_get_matrix_dataset_data_by_ids(
        self, client: TestClient, minimal_db: SessionWithUser, settings, mock_celery
    ):
        factories.sample_type(
            minimal_db, settings.admin_users[0], "model", given_ids=["ACH-1", "ACH-2"]
        )
        dataset = factories.matrix_dataset(
            minimal_db, settings, feature_type=None, sample_type="model"
        )
        # TODO: Delete after deprecated endpoint is deleted
        response = client.post(
            f"/datasets/data/{dataset.id}",
            json={
                "features": ["A", "B"],
                "feature_identifier": "id",
                "samples": ["ACH-1", "ACH-2"],
                "sample_identifier": "id",
            },
        )
        assert response.json() == {
            "A": {"ACH-1": 0.0, "ACH-2": 3.0},
            "B": {"ACH-1": 1.0, "ACH-2": 4.0},
        }

        response = client.post(
            f"/datasets/matrix/{dataset.id}",
            json={
                "features": ["A", "B"],
                "feature_identifier": "id",
                "samples": ["ACH-1", "ACH-2"],
                "sample_identifier": "id",
            },
        )
        assert response.json() == {
            "A": {"ACH-1": 0.0, "ACH-2": 3.0},
            "B": {"ACH-1": 1.0, "ACH-2": 4.0},
        }
        # verify that when we fetch a feature which doesn't exist, we silently drop the invalid feature
        # TODO: Delete after deprecated endpoint is deleted
        response = client.post(
            f"/datasets/data/{dataset.id}",
            json={
                "features": ["A", "INVALID"],
                "feature_identifier": "id",
                "samples": ["ACH-1"],
                "sample_identifier": "id",
            },
        )
        assert response.status_code == 200
        assert response.json() == {
            "A": {"ACH-1": 0.0},
        }
        response = client.post(
            f"/datasets/matrix/{dataset.id}",
            json={
                "features": ["A", "INVALID"],
                "feature_identifier": "id",
                "samples": ["ACH-1"],
                "sample_identifier": "id",
            },
        )
        assert response.status_code == 200
        assert response.json() == {
            "A": {"ACH-1": 0.0},
        }

        # verify if strict keyword provided, when we fetch a feature that doesn't exist, we raise an error
        response = client.post(
            f"/datasets/matrix/{dataset.id}?strict=True",
            json={
                "features": ["A", "INVALID"],
                "feature_identifier": "id",
                "samples": ["ACH-1"],
                "sample_identifier": "id",
            },
        )
        assert response.status_code == 404
        assert response.json()["detail"]

        # same for a missing sample
        # TODO: Delete after deprecated endpoint is deleted
        response = client.post(
            f"/datasets/data/{dataset.id}",
            json={
                "features": ["A"],
                "feature_identifier": "id",
                "samples": ["ACH-1", "INVALID"],
                "sample_identifier": "id",
            },
        )

        assert response.status_code == 200
        assert response.json() == {
            "A": {"ACH-1": 0.0},
        }
        response = client.post(
            f"/datasets/matrix/{dataset.id}",
            json={
                "features": ["A"],
                "feature_identifier": "id",
                "samples": ["ACH-1", "INVALID"],
                "sample_identifier": "id",
            },
        )

        assert response.status_code == 200
        assert response.json() == {
            "A": {"ACH-1": 0.0},
        }

        response = client.post(
            f"/datasets/matrix/{dataset.id}?strict=True",
            json={
                "features": ["A"],
                "feature_identifier": "id",
                "samples": ["ACH-1", "INVALID"],
                "sample_identifier": "id",
            },
        )

        assert response.status_code == 404
        assert response.json()["detail"]

    def test_get_matrix_dataset_data_by_labels(
        self, client: TestClient, minimal_db: SessionWithUser, settings, mock_celery
    ):
        sample_type = factories.add_dimension_type(
            minimal_db,
            settings,
            settings.admin_users[0],
            name="sample_type_foo",
            display_name="Sample Type Foo",
            id_column="ID",
            axis="sample",
            annotation_type_mapping={
                "ID": AnnotationType.text,
                "label": AnnotationType.text,
            },
            metadata_df=pd.DataFrame(
                {
                    "ID": ["sampleID1", "sampleID2", "sampleID3"],
                    "label": ["sampleLabel1", "sampleLabel2", "sampleLabel3"],
                }
            ),
        )
        feature_type = factories.add_dimension_type(
            minimal_db,
            settings,
            settings.admin_users[0],
            name="feature_type_foobar",
            display_name="Feature Type Foobar",
            id_column="ID",
            axis="feature",
            annotation_type_mapping={
                "ID": AnnotationType.text,
                "label": AnnotationType.text,
            },
            metadata_df=pd.DataFrame(
                {
                    "ID": ["featureID1", "featureID2", "featureID3"],
                    "label": ["featureLabel1", "featureLabel2", "featureLabel3"],
                }
            ),
        )
        matrix_values = factories.matrix_csv_data_file_with_values(
            feature_ids=["featureID1", "featureID2", "featureID3"],
            sample_ids=["sampleID1", "sampleID2", "sampleID3"],
            values=np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]]),
        )
        #             featureID1  featureID2  featureID3
        #   sampleID1          1           2           3
        #   sampleID2          4           5           6
        #   sampleID3          7           8           9
        matrix_dataset = factories.matrix_dataset(
            minimal_db,
            settings,
            sample_type="sample_type_foo",
            feature_type="feature_type_foobar",
            data_file=matrix_values,
        )
        # TODO: Delete after deprecated endpoint is deleted
        response = client.post(
            f"/datasets/data/{matrix_dataset.id}",
            json={
                "features": ["featureLabel1", "featureLabel2"],
                "feature_identifier": "label",
                "samples": ["sampleLabel2", "sampleLabel3"],
                "sample_identifier": "label",
            },
        )
        assert response.json() == {
            "featureLabel1": {"sampleLabel2": 4.0, "sampleLabel3": 7.0},
            "featureLabel2": {"sampleLabel2": 5.0, "sampleLabel3": 8.0},
        }
        response = client.post(
            f"/datasets/matrix/{matrix_dataset.id}",
            json={
                "features": ["featureLabel1", "featureLabel2"],
                "feature_identifier": "label",
                "samples": ["sampleLabel2", "sampleLabel3"],
                "sample_identifier": "label",
            },
        )
        assert response.json() == {
            "featureLabel1": {"sampleLabel2": 4.0, "sampleLabel3": 7.0},
            "featureLabel2": {"sampleLabel2": 5.0, "sampleLabel3": 8.0},
        }
        # Test strict keyword for missing features or samples
        response = client.post(
            f"/datasets/matrix/{matrix_dataset.id}?strict=True",
            json={
                "features": ["featureLabel1", "INVALID_FEATURE"],
                "feature_identifier": "label",
                "samples": ["sampleLabel2", "INVALID_SAMPLE"],
                "sample_identifier": "label",
            },
        )
        assert response.status_code == 404
        # Features checked first then
        assert response.json()["detail"]["error_type"] == "FEATURE_NOT_FOUND"

    def test_get_aggregated_matrix_dataset_data(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        settings,
        mock_celery,
        public_group,
        tmpdir,
    ):
        factories.sample_type(
            minimal_db,
            settings.admin_users[0],
            "model",
            given_ids=["Id1", "Id2", "Id3"],
        )
        data_path = str(tmpdir.join("dataset.csv"))
        pd.DataFrame(
            {"A": [1, 2, 3], "B": [3, 4, pd.NA], "C": [4, 3, 2]},
            index=["Id1", "Id2", "Id3"],  # type: ignore[arg-type]
        ).to_csv(data_path)
        """
                A   B   C
        ------------------- 
        Id1     1   3   4
        Id2     2   4   3
        Id3     3   NA  2
        """
        file_ids, expected_md5 = upload_and_get_file_ids(client, filename=data_path)

        admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}
        matrix_dataset = client.post(
            "/dataset-v2/",
            json={
                "format": "matrix",
                "name": "Test Aggregation dataset",
                "units": "a unit",
                "sample_type": "model",
                "data_type": "User upload",
                "file_ids": file_ids,
                "dataset_md5": expected_md5,
                "is_transient": False,
                "group_id": public_group.id,
                "value_type": "continuous",
                "allowed_values": None,
            },
            headers=admin_headers,
        )
        assert_status_ok(matrix_dataset)

        response = client.post(
            f"/datasets/matrix/{matrix_dataset.json()['result']['datasetId']}",
            json={"aggregate": {"aggregate_by": "samples", "aggregation": "mean"}},
        )
        """
        Expected:
            mean
        ------------------- 
        A     2
        B     3.5
        C     3
        """
        assert response.json() == {"mean": {"A": 2, "B": 3.5, "C": 3}}

        response = client.post(
            f"/datasets/matrix/{matrix_dataset.json()['result']['datasetId']}",
            json={"aggregate": {"aggregate_by": "samples", "aggregation": "25%tile"}},
        )
        """
        Expected:
            25%tile
        ------------------- 
        A    1.0050
        B    3.0025
        C    2.0050
        """
        assert response.json() == {"25%tile": {"A": 1.0050, "B": 3.0025, "C": 2.0050}}

        response = client.post(
            f"/datasets/matrix/{matrix_dataset.json()['result']['datasetId']}",
            json={
                "feature_identifier": "id",
                "features": ["A", "B"],
                "sample_identifier": "id",
                "samples": ["Id1", "Id3"],
                "aggregate": {"aggregate_by": "features", "aggregation": "mean"},
            },
        )
        """
        Expected:
                mean
        ------------------- 
        Id1     2
        Id3     3
        """
        assert response.json() == {"mean": {"Id1": 2, "Id3": 3}}

    def test_bad_matrix_dataset_categorical_aggregation(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        settings,
        mock_celery,
        public_group,
        tmpdir,
    ):
        data_path = str(tmpdir.join("dataset.csv"))
        pd.DataFrame(
            {"A": ["Yes", "No", "Yes"], "B": ["No", pd.NA, "Yes"]},
            index=["Id1", "Id2", "Id3"],  # type: ignore[arg-type]
        ).to_csv(data_path)

        file_ids, expected_md5 = upload_and_get_file_ids(client, filename=data_path)

        admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}
        matrix_dataset = client.post(
            "/dataset-v2/",
            json={
                "format": "matrix",
                "name": "Test Aggregation Categorical Dataset",
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "file_ids": file_ids,
                "dataset_md5": expected_md5,
                "is_transient": False,
                "group_id": public_group.id,
                "value_type": "categorical",
                "allowed_values": ["Yes", "No"],
            },
            headers=admin_headers,
        )
        assert_status_ok(matrix_dataset)

        response = client.post(
            f"/datasets/matrix/{matrix_dataset.json()['result']['datasetId']}",
            json={"aggregate": {"aggregate_by": "samples", "aggregation": "mean"}},
        )
        assert_status_not_ok(response)

    def test_get_tabular_dataset_data(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        mock_celery,
        private_group: Dict,
        settings,
    ):
        """
        Test the loading of tabular data - including filtering by ID, label and column.
        """
        admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}

        # Give metadata for depmap model
        r_add_metadata_for_depmap_model = client.patch(
            "/types/sample/depmap_model/metadata",
            data={
                "name": "depmap model metadata",
                "annotation_type_mapping": json.dumps(
                    {"annotation_type_mapping": {"label": "text", "depmap_id": "text",}}
                ),
            },
            files={
                "metadata_file": (
                    "new_feature_metadata",
                    factories.tabular_csv_data_file(
                        cols=["label", "depmap_id"],
                        row_values=[
                            ["ach1", "ACH-1"],
                            ["ach2", "ACH-2"],
                            ["ach3", "ACH-3"],
                        ],
                    ),
                    "text/csv",
                )
            },
            headers=admin_headers,
        )
        assert_status_ok(
            r_add_metadata_for_depmap_model
        ), r_add_metadata_for_depmap_model.status_code == 200

        # Create tabular dataset
        tabular_file_1 = factories.tabular_csv_data_file(
            cols=[
                "depmap_id",
                "label",
                "col_1",
                "col_2",
                "col_3",
                "col_4",
                "col_5",
            ],  # NOTE: Add 'label' col to ensure endpoint only uses 'label' in dim type metadata
            row_values=[
                ["ACH-1", "other_label_1", 1, "hi", False, "cat1", '["a"]'],
                ["ACH-2", "other_label_2", np.NaN, "bye", np.NaN, "cat2", np.NaN],
            ],
        )

        tabular_file_ids_1, tabular_file_1_hash = upload_and_get_file_ids(
            client, tabular_file_1
        )

        tabular_dataset_1_response = client.post(
            "/dataset-v2/",
            json={
                "format": "tabular",
                "name": "Test Dataset 1",
                "index_type": "depmap_model",
                "data_type": "User upload",
                "file_ids": tabular_file_ids_1,
                "dataset_md5": tabular_file_1_hash,
                "is_transient": False,
                "group_id": private_group["id"],
                "dataset_metadata": None,
                "columns_metadata": {
                    "depmap_id": {"col_type": "text",},
                    "label": {"col_type": "text"},
                    "col_1": {"units": "a unit", "col_type": "continuous"},
                    "col_2": {"col_type": "text"},
                    "col_3": {"col_type": "categorical"},
                    "col_4": {"col_type": "categorical"},
                    "col_5": {"col_type": "list_strings"},
                },
            },
            headers=admin_headers,
        )
        assert_status_ok(tabular_dataset_1_response)
        tabular_dataset_1_id = tabular_dataset_1_response.json()["result"]["dataset"][
            "id"
        ]

        tabular_dataset_1 = (
            minimal_db.query(Dataset).filter_by(id=tabular_dataset_1_id).one()
        )
        assert tabular_dataset_1

        # Get a subset of the tabular dataset by id
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}",
            json={
                "indices": ["ACH-2"],
                "identifier": "id",
                "columns": ["col_1", "col_2"],
            },
            headers=admin_headers,
        )
        assert res.json() == {"col_1": {"ACH-2": None}, "col_2": {"ACH-2": "bye"}}

        # Get a subset of the tabular dataset by label
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}",
            json={
                "indices": ["ach1", "ach2"],
                "identifier": "label",
                "columns": ["col_2"],
            },
            headers=admin_headers,
        )
        assert res.json() == {"col_2": {"ach1": "hi", "ach2": "bye"}}

        # Test when indices not provided all data for those indices should be returned
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}",
            json={"indices": None, "identifier": None, "columns": ["col_2"],},
            headers=admin_headers,
        )
        assert res.json() == {"col_2": {"ACH-1": "hi", "ACH-2": "bye"}}

        # When identifier 'label' is provided and indices not provided, the return should be all data with labels used as indices
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}",
            json={"indices": None, "identifier": "label", "columns": ["col_2"],},
            headers=admin_headers,
        )
        assert res.json() == {"col_2": {"ach1": "hi", "ach2": "bye"}}

        # When columns not provided, all columns are returned
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}",
            json={"indices": ["ACH-1"], "identifier": "id", "columns": None,},
            headers=admin_headers,
        )
        assert res.json() == {
            "depmap_id": {"ACH-1": "ACH-1"},
            "label": {"ACH-1": "other_label_1"},
            "col_1": {"ACH-1": 1},
            "col_2": {"ACH-1": "hi"},
            "col_3": {"ACH-1": "False"},
            "col_4": {"ACH-1": "cat1"},
            "col_5": {"ACH-1": ["a"]},
        }

        # When both columns and indices not provided, the entire dataset should return'
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}",
            json={"indices": None, "identifier": None, "columns": None,},
            headers=admin_headers,
        )
        assert res.json() == {
            "depmap_id": {"ACH-1": "ACH-1", "ACH-2": "ACH-2"},
            "label": {"ACH-1": "other_label_1", "ACH-2": "other_label_2"},
            "col_1": {"ACH-1": 1, "ACH-2": None},
            "col_2": {"ACH-1": "hi", "ACH-2": "bye"},
            "col_3": {"ACH-1": "False", "ACH-2": None},
            "col_4": {"ACH-1": "cat1", "ACH-2": "cat2"},
            "col_5": {"ACH-1": ["a"], "ACH-2": None},
        }
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}", headers=admin_headers,
        )
        assert res.json() == {
            "depmap_id": {"ACH-1": "ACH-1", "ACH-2": "ACH-2"},
            "label": {"ACH-1": "other_label_1", "ACH-2": "other_label_2"},
            "col_1": {"ACH-1": 1, "ACH-2": None},
            "col_2": {"ACH-1": "hi", "ACH-2": "bye"},
            "col_3": {"ACH-1": "False", "ACH-2": None},
            "col_4": {"ACH-1": "cat1", "ACH-2": "cat2"},
            "col_5": {"ACH-1": ["a"], "ACH-2": None},
        }

        # Test if no matches found with given query params --> empty df
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}",
            json={
                "indices": ["ACH-3"],  # ACH-3 doesn't exist in dataset
                "identifier": "id",
                "columns": ["nonexistant_col"],
            },
            headers=admin_headers,
        )
        assert res.json() == {}

        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}",
            json={"indices": ["ACH-3"], "identifier": "id", "columns": None,},
            headers=admin_headers,
        )
        assert res.json() == {}

        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}",
            json={
                "indices": ["ACH-1"],
                "identifier": "id",
                "columns": ["nonexistant_col"],
            },
            headers=admin_headers,
        )
        assert res.json() == {}

        # Test when either one of the indices or columns as request param does not exist in dataset
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}",
            json={
                "indices": ["ACH-1", "ACH-3"],  # ACH-3 doesn't exist in dataset
                "identifier": "id",
                "columns": ["col_1", "nonexistant_col"],
            },
            headers=admin_headers,
        )
        assert res.json() == {"col_1": {"ACH-1": 1}}

        # With strict keyword
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}?strict=True",
            json={
                "indices": ["ACH-1", "ACH-3"],  # ACH-3 doesn't exist in dataset
                "identifier": "id",
                "columns": ["col_1", "nonexistant_col"],
            },
            headers=admin_headers,
        )
        assert res.status_code == 400
        assert (
            res.json()["detail"]
            == "1 missing columns: {'nonexistant_col'} and 1 missing indices: {'ACH-3'}"
        )

        # Raise error if identifier not provided and indices provided
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}",
            json={"indices": ["ACH-1"], "identifier": None, "columns": ["col_1"],},
            headers=admin_headers,
        )
        assert res.status_code == 400

    def test_get_tabular_dataset_data_no_index_metadata(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        mock_celery,
        private_group: Dict,
        settings,
    ):
        """Get the data for a tabular dataset which has no metadata."""
        admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}

        tabular_file_2 = factories.tabular_csv_data_file(
            cols=["depmap_id", "col_1", "col_2"], row_values=[["ACH-1", 1, "hi"]],
        )
        tabular_file_ids_2, tabular_file_2_hash = upload_and_get_file_ids(
            client, tabular_file_2
        )
        tabular_dataset_2_response = client.post(
            "/dataset-v2/",
            json={
                "format": "tabular",
                "name": "Test Dataset 2",
                "index_type": "depmap_model",
                "data_type": "User upload",
                "file_ids": tabular_file_ids_2,
                "dataset_md5": tabular_file_2_hash,
                "is_transient": False,
                "group_id": private_group["id"],
                "dataset_metadata": None,
                "columns_metadata": {
                    "depmap_id": {"col_type": "text",},
                    "col_1": {"units": "a unit", "col_type": "continuous"},
                    "col_2": {"col_type": "text"},
                },
            },
            headers=admin_headers,
        )
        assert_status_ok(tabular_dataset_2_response)
        tabular_dataset_2_id = tabular_dataset_2_response.json()["result"]["dataset"][
            "id"
        ]

        tabular_dataset_2 = (
            minimal_db.query(Dataset).filter_by(id=tabular_dataset_2_id).one()
        )
        assert tabular_dataset_2

        # Get a subset of the tabular dataset by id
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_2_id}",
            json={
                "indices": ["ACH-1"],
                "identifier": "id",
                "columns": ["col_1", "col_2"],
            },
            headers=admin_headers,
        )
        assert res.json() == {"col_1": {"ACH-1": 1}, "col_2": {"ACH-1": "hi"}}

        # Get a subset of the tabular dataset by label (no data)
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_2_id}",
            json={
                "indices": ["ach1"],
                "identifier": "label",
                "columns": ["col_1", "col_2"],
            },
            headers=admin_headers,
        )
        assert res.json() == {}

    def test_get_dimension_data(
        self, client: TestClient, minimal_db: SessionWithUser, public_group, settings,
    ):
        # Define label metadata for our features
        factories.add_dimension_type(
            minimal_db,
            settings,
            user=settings.admin_users[0],
            name="feature-with-metadata",
            display_name="Feature With Metadata",
            id_column="ID",
            annotation_type_mapping={
                "ID": AnnotationType.text,
                "label": AnnotationType.text,
            },
            axis="feature",
            metadata_df=pd.DataFrame(
                {
                    "ID": ["featureID1", "featureID2", "featureID3"],
                    "label": ["featureLabel1", "featureLabel2", "featureLabel3"],
                }
            ),
        )

        # Define a matrix dataset
        # This matrix contains values which don't exist in the metadata
        # (sampleID4, featureID4) and should therefor be ignored
        example_matrix_values = factories.matrix_csv_data_file_with_values(
            feature_ids=["featureID1", "featureID2", "featureID3", "featureID4"],
            sample_ids=["sampleID1", "sampleID2", "sampleID3", "sampleID4"],
            values=np.array(
                [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]]
            ),
        )
        dataset_given_id = "dataset_123"
        dataset_with_metadata = factories.matrix_dataset(
            minimal_db,
            settings,
            feature_type="feature-with-metadata",
            data_file=example_matrix_values,
            given_id=dataset_given_id,
        )

        # Test get by feature ID
        response = client.post(
            "/datasets/dimension/data",
            json={
                "dataset_id": dataset_with_metadata.id,
                "identifier": "sampleID1",
                "identifier_type": "sample_id",
            },
            headers={"X-Forwarded-User": "some-public-user"},
        )

        assert_status_ok(response)
        response_content = response.json()
        assert response_content is not None
        assert response_content["ids"] == ["featureID1", "featureID2", "featureID3"]
        assert response_content["labels"] == [
            "featureLabel1",
            "featureLabel2",
            "featureLabel3",
        ]
        assert response_content["values"] == [1, 2, 3]

    def test_get_dimension_data_not_found(
        self, client: TestClient, minimal_db: SessionWithUser, public_group, settings,
    ):
        # Define label metadata for our features
        factories.add_dimension_type(
            minimal_db,
            settings,
            user=settings.admin_users[0],
            name="feature-with-metadata",
            display_name="Feature With Metadata",
            id_column="ID",
            annotation_type_mapping={
                "ID": AnnotationType.text,
                "label": AnnotationType.text,
            },
            axis="feature",
            metadata_df=pd.DataFrame(
                {
                    "ID": ["featureID1", "featureID2", "featureID3"],
                    "label": ["featureLabel1", "featureLabel2", "featureLabel3"],
                }
            ),
        )

        # Define a matrix dataset
        # This matrix contains values which don't exist in the metadata
        # (sampleID4, featureID4) and should therefor be ignored
        example_matrix_values = factories.matrix_csv_data_file_with_values(
            feature_ids=["featureID1", "featureID2", "featureID3", "featureID4"],
            sample_ids=["sampleID1", "sampleID2", "sampleID3", "sampleID4"],
            values=np.array(
                [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]]
            ),
        )
        dataset_given_id = "dataset_123"
        dataset_with_metadata = factories.matrix_dataset(
            minimal_db,
            settings,
            feature_type="feature-with-metadata",
            data_file=example_matrix_values,
            given_id=dataset_given_id,
        )

        # Test that lookups by non-existant datasets return 404s
        response = client.post(
            "/datasets/dimension/data",
            json={
                "dataset_id": "fake dataset ID",  # non-existant dataset ID
                "identifier": "sampleID1",
                "identifier_type": "sample_id",
            },
            headers={"X-Forwarded-User": "some-public-user"},
        )

        assert_status_not_ok(response)
        assert response.status_code == 404

        # Test that lookups by non-existant features return 404s
        response = client.post(
            "/datasets/dimension/data",
            json={
                "dataset_id": dataset_given_id,
                "identifier": "fake sample id",  # non-existant sample ID
                "identifier_type": "sample_id",
            },
            headers={"X-Forwarded-User": "some-public-user"},
        )

        assert_status_not_ok(response)
        assert response.status_code == 404
