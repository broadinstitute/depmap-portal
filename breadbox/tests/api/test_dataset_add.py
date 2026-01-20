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
