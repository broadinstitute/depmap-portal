import io

from fastapi.testclient import TestClient

from breadbox.db.session import SessionWithUser, SessionLocalWithUser
from breadbox.schemas.dataset import AddDatasetResponse
from breadbox.compute import dataset_uploads_tasks
from breadbox.celery_task import utils
from breadbox.models.dataset import TabularDataset, TabularCell, TabularColumn
from sqlalchemy import and_

from typing import Dict
from ..utils import assert_status_ok
import pytest
import numpy as np
from ..utils import upload_and_get_file_ids


class TestPost:
    def test_upload_data_as_parquet(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        private_group,
        mock_celery,
        monkeypatch,
        tmpdir,
    ):
        user = "someone@private-group.com"
        headers = {"X-Forwarded-User": user}

        data_path = str(tmpdir.join("data.parquet"))
        pd.DataFrame(
            {"index": ["ACH-1", "ACH-2"], "A": [0.1, 0.2], "B": [0.3, 0.4]}
        ).to_parquet(data_path)

        file_ids, expected_md5 = upload_and_get_file_ids(client, filename=data_path)

        matrix_dataset = client.post(
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
                "allowed_values": None,
                "data_file_format": "parquet",
            },
            headers=headers,
        )
        assert_status_ok(matrix_dataset)
        assert matrix_dataset.status_code == 202
        assert matrix_dataset.json()["state"] == "SUCCESS"
        dataset_id = matrix_dataset.json()["result"]["datasetId"]

        result = client.post(
            f"/datasets/matrix/{dataset_id}",
            json={"features": ["A", "B"], "feature_identifier": "id",},
            headers=headers,
        )
        assert_status_ok(result)
        assert result.json() == {
            "A": {"ACH-1": 0.1, "ACH-2": 0.2},
            "B": {"ACH-1": 0.3, "ACH-2": 0.4},
        }

    # Dataset post endpoint using uploads
    def test_dataset_uploads_task(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        private_group: Dict,
        mock_celery,
        monkeypatch,
    ):
        user = "someone@private-group.com"
        headers = {"X-Forwarded-User": user}
        user_db_session = SessionLocalWithUser(user)

        file = factories.continuous_matrix_csv_file()
        file_ids, expected_md5 = upload_and_get_file_ids(client, file, chunk_count=3)
        matrix_dataset_given_id = "some_given_id"

        matrix_dataset_w_simple_metadata = client.post(
            "/dataset-v2/",
            json={
                "format": "matrix",
                "name": "a dataset",
                "given_id": matrix_dataset_given_id,
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "file_ids": file_ids,
                "dataset_md5": expected_md5,
                "is_transient": False,
                "group_id": private_group["id"],
                "value_type": "continuous",
                "allowed_values": None,
                "dataset_metadata": {"yah": "nah"},
                "short_name": "m1",
                "description": "a dataset",
                "version": "v1",
            },
            headers=headers,
        )
        assert_status_ok(matrix_dataset_w_simple_metadata)
        assert matrix_dataset_w_simple_metadata.status_code == 202
        assert matrix_dataset_w_simple_metadata.json()["state"] == "SUCCESS"
        assert matrix_dataset_w_simple_metadata.json()["result"]["datasetId"]
        matrix_dataset_result = matrix_dataset_w_simple_metadata.json()["result"][
            "dataset"
        ]
        assert matrix_dataset_result is not None
        assert matrix_dataset_result.get("id") is not None
        assert matrix_dataset_result.get("given_id") == matrix_dataset_given_id
        assert matrix_dataset_result.get("short_name") == "m1"
        assert matrix_dataset_result.get("description") == "a dataset"
        assert matrix_dataset_result.get("version") == "v1"

        # Test tabular dataset
        tabular_data_file = factories.tabular_csv_data_file(
            cols=["depmap_id", "attr1", "attr2", "attr3"],
            row_values=[["ACH-1", 1.0, 0, '["a"]'], ["ACH-2", 2.0, 1, '["d", "c"]']],
        )
        tabular_dataset_given_id = "some_other_given_id"

        tabular_file_ids, hash = upload_and_get_file_ids(
            client, tabular_data_file, chunk_count=3
        )

        assert len(tabular_file_ids) == 3
        tabular_dataset_response = client.post(
            "/dataset-v2/",
            json={
                "format": "tabular",
                "name": "a table dataset",
                "given_id": tabular_dataset_given_id,
                "index_type": "depmap_model",
                "data_type": "User upload",
                "file_ids": tabular_file_ids,
                "dataset_md5": hash,
                "is_transient": False,
                "group_id": private_group["id"],
                "dataset_metadata": {"yah": "nah"},
                "columns_metadata": {
                    "depmap_id": {"units": None, "col_type": "text"},
                    "attr1": {"units": "some units", "col_type": "continuous"},
                    "attr2": {"units": None, "col_type": "categorical"},
                    "attr3": {"units": None, "col_type": "list_strings"},
                },
                "short_name": "t1",
                "description": "a table",
                "version": "v2",
            },
            headers=headers,
        )
        assert_status_ok(tabular_dataset_response)
        assert tabular_dataset_response.status_code == 202
        assert tabular_dataset_response.json()["state"] == "SUCCESS"
        tabular_dataset_result = tabular_dataset_response.json()["result"]["dataset"]
        assert tabular_dataset_result.get("id") is not None
        assert tabular_dataset_result.get("given_id") == tabular_dataset_given_id
        assert tabular_dataset_result.get("short_name") == "t1"
        assert tabular_dataset_result.get("description") == "a table"
        assert tabular_dataset_result.get("version") == "v2"

        # list string value is not all strings
        tabular_data_file_bad_list_strings = factories.tabular_csv_data_file(
            cols=["depmap_id", "attr1", "attr2", "attr3"],
            row_values=[["ACH-1", 1.0, 0, '["a"]'], ["ACH-2", 2.0, 1, '[1, "c"]']],
        )
        bad_list_strings_file_ids, bad_list_strings_hash = upload_and_get_file_ids(
            client, tabular_data_file_bad_list_strings
        )

        def mock_failed_task_result(db, params, user):
            return {"result": "Column 'attr1' failed validator"}

        monkeypatch.setattr(
            dataset_uploads_tasks, "dataset_upload", mock_failed_task_result,
        )

        def mock_return_failed_task(result):
            return AddDatasetResponse(
                id="123",
                state="FAILURE",
                result=result,
                message=None,
                percentComplete=None,
            )

        monkeypatch.setattr(
            dataset_uploads_tasks, "dataset_upload", mock_failed_task_result,
        )
        monkeypatch.setattr(utils, "format_task_status", mock_return_failed_task)
        bad_list_strings_file_ids_dataset = client.post(
            "/dataset-v2/",
            json={
                "format": "tabular",
                "name": "a table dataset",
                "index_type": "depmap_model",
                "data_type": "User upload",
                "file_ids": bad_list_strings_file_ids,
                "dataset_md5": bad_list_strings_hash,
                "is_transient": False,
                "group_id": private_group["id"],
                "dataset_metadata": {"yah": "nah"},
                "columns_metadata": {
                    "depmap_id": {"units": None, "col_type": "text"},
                    "attr1": {"units": "some units", "col_type": "continuous"},
                    "attr3": {"units": None, "col_type": "list_strings",},
                },
            },
            headers=headers,
        )
        assert bad_list_strings_file_ids_dataset.status_code == 202
        assert bad_list_strings_file_ids_dataset.json()["state"] == "FAILURE"

    def test_continuous_with_nas_dataset_uploads_task(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        private_group: Dict,
        mock_celery,
        monkeypatch,
    ):
        user = "someone@private-group.com"
        headers = {"X-Forwarded-User": user}
        user_db_session = SessionLocalWithUser(user)

        file = factories.matrix_csv_data_file_with_values(
            values=[1.01, 2, np.nan, None, 3.0, pd.NA]
        )
        file_ids, expected_md5 = upload_and_get_file_ids(client, file, chunk_count=3)
        matrix_dataset_given_id = "some_given_id"

        matrix_dataset_w_simple_metadata = client.post(
            "/dataset-v2/",
            json={
                "format": "matrix",
                "name": "a dataset",
                "given_id": matrix_dataset_given_id,
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "file_ids": file_ids,
                "dataset_md5": expected_md5,
                "is_transient": False,
                "group_id": private_group["id"],
                "value_type": "continuous",
                "allowed_values": None,
                "dataset_metadata": {"yah": "nah"},
                "short_name": "m1",
                "description": "a dataset",
                "version": "v1",
            },
            headers=headers,
        )
        assert_status_ok(matrix_dataset_w_simple_metadata)
        assert matrix_dataset_w_simple_metadata.status_code == 202
        assert matrix_dataset_w_simple_metadata.json()["state"] == "SUCCESS"

        # Read out continuous with NAs dataset values
        matrix_subset = client.post(
            f"/datasets/matrix/{matrix_dataset_given_id}",
            json={
                "features": ["A", "B", "C"],
                "feature_identifier": "id",
                "samples": ["ACH-1", "ACH-2"],
                "sample_identifier": "id",
            },
            headers=headers,
        )
        assert_status_ok(matrix_subset)
        matrix_subset_result = matrix_subset.json()
        assert matrix_subset_result == {
            "A": {"ACH-1": 1.01, "ACH-2": None},
            "B": {"ACH-1": 2, "ACH-2": 3.0},
            "C": {"ACH-1": None, "ACH-2": None},
        }

    def test_categorical_dataset_uploads_task(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        private_group: Dict,
        mock_celery,
        monkeypatch,
    ):
        user = "someone@private-group.com"
        headers = {"X-Forwarded-User": user}

        # Test categorical matrix
        file1 = factories.matrix_csv_data_file_with_values(
            values=["No mutation", "heterozygous", "homozygous"]
        )
        file_ids, expected_md5 = upload_and_get_file_ids(client, file1)
        categorical_dataset1_given_id = "some_given_id"

        categorical_matrix_dataset = client.post(
            "/dataset-v2/",
            json={
                "format": "matrix",
                "name": "a dataset",
                "given_id": categorical_dataset1_given_id,
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "file_ids": file_ids,
                "dataset_md5": expected_md5,
                "is_transient": False,
                "group_id": private_group["id"],
                "value_type": "categorical",
                "allowed_values": ["No mutation", "heterozygous", "homozygous"],
                "dataset_metadata": {"yah": "nah"},
                "short_name": "m1",
                "description": "a dataset",
                "version": "v1",
            },
            headers=headers,
        )
        assert_status_ok(categorical_matrix_dataset)
        assert categorical_matrix_dataset.status_code == 202
        assert categorical_matrix_dataset.json()["state"] == "SUCCESS"
        assert categorical_matrix_dataset.json()["result"]["datasetId"]
        categorical_matrix_dataset_result = categorical_matrix_dataset.json()["result"][
            "dataset"
        ]
        assert categorical_matrix_dataset_result is not None
        assert (
            categorical_matrix_dataset_result.get("given_id")
            == categorical_dataset1_given_id
        )

        # Test matrix with True and False
        file2 = factories.matrix_csv_data_file_with_values(values=[True, False])
        file_ids, expected_md5 = upload_and_get_file_ids(client, file2)
        categorical_dataset2_given_id = "another given id"
        categorical_matrix_dataset2 = client.post(
            "/dataset-v2/",
            json={
                "format": "matrix",
                "name": "a dataset",
                "given_id": categorical_dataset2_given_id,
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "file_ids": file_ids,
                "dataset_md5": expected_md5,
                "is_transient": False,
                "group_id": private_group["id"],
                "value_type": "categorical",
                "allowed_values": ["True", "False"],
                "dataset_metadata": {"yah": "nah"},
                "short_name": "m1",
                "description": "a dataset",
                "version": "v1",
            },
            headers=headers,
        )
        assert_status_ok(categorical_matrix_dataset2)
        assert categorical_matrix_dataset2.json()["state"] == "SUCCESS"
        assert categorical_matrix_dataset2.json()["result"]["datasetId"]
        categorical_matrix_dataset2_result = categorical_matrix_dataset2.json()[
            "result"
        ]["dataset"]
        assert (
            categorical_matrix_dataset2_result.get("given_id")
            == categorical_dataset2_given_id
        )

        # Test case insensitive values are fine for categorical datasets and NAs
        file3 = factories.matrix_csv_data_file_with_values(
            values=[True, False, pd.NA, np.nan, "true", None]
        )
        file_ids, expected_md5 = upload_and_get_file_ids(client, file3)
        categorical_dataset3_given_id = "yet another given id"
        categorical_matrix_dataset3 = client.post(
            "/dataset-v2/",
            json={
                "format": "matrix",
                "name": "a dataset",
                "given_id": categorical_dataset3_given_id,
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "file_ids": file_ids,
                "dataset_md5": expected_md5,
                "is_transient": False,
                "group_id": private_group["id"],
                "value_type": "categorical",
                "allowed_values": ["True", "false"],  # case insensitve allowed values
                "dataset_metadata": {"yah": "nah"},
                "short_name": "m1",
                "description": "a dataset",
                "version": "v1",
            },
            headers=headers,
        )
        assert_status_ok(categorical_matrix_dataset3)
        assert categorical_matrix_dataset3.json()["state"] == "SUCCESS"
        assert categorical_matrix_dataset3.json()["result"]["datasetId"]
        categorical_matrix_dataset3_result = categorical_matrix_dataset3.json()[
            "result"
        ]["dataset"]
        assert (
            categorical_matrix_dataset3_result.get("given_id")
            == categorical_dataset3_given_id
        )

        # Read out list of string with NAs dataset values
        matrix_subset = client.post(
            f"/datasets/matrix/{categorical_dataset3_given_id}",
            json={
                "features": ["A", "B", "C"],
                "feature_identifier": "id",
                "samples": ["ACH-1", "ACH-2"],
                "sample_identifier": "id",
            },
            headers=headers,
        )
        assert_status_ok(matrix_subset)
        matrix_subset_result = matrix_subset.json()
        assert matrix_subset_result == {
            "A": {"ACH-1": "True", "ACH-2": None},
            "B": {"ACH-1": "false", "ACH-2": "True"},
            "C": {"ACH-1": None, "ACH-2": None},
        }

    @pytest.mark.parametrize(
        "value_type, allowed_values, status_code",
        [
            (
                "continuous",
                ["Thing1", "Thing2", "Thing3"],
                422,
            ),  # continuous datasets should not have allowed values
            (
                "categorical",
                ["Thing1", "Thing2", "Thing3", "Thing4"],
                202,
            ),  # allowed values have a value (Thing4) not in dataset. This is acceptable
            (
                "categorical",
                ["Thing1", "Thing2"],
                400,
            ),  # missing allowed value/dataset have value not in allowed values
            (
                "categorical",
                ["Thing1", "thing1", "Thing2", "Thing3"],
                400,
            ),  # repeated allowed values due to case
        ],
    )
    def test_incorrect_allowed_values(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        private_group: Dict,
        mock_celery,
        value_type,
        allowed_values,
        status_code,
    ):
        user = "someone@private-group.com"
        headers = {"X-Forwarded-User": user}

        file = factories.matrix_csv_data_file_with_values()
        file_ids, expected_md5 = upload_and_get_file_ids(client, file)
        categorical_dataset_given_id = "some_given_id"

        categorical_matrix_dataset = client.post(
            "/dataset-v2/",
            json={
                "format": "matrix",
                "name": "a dataset",
                "given_id": categorical_dataset_given_id,
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "file_ids": file_ids,
                "dataset_md5": expected_md5,
                "is_transient": False,
                "group_id": private_group["id"],
                "value_type": value_type,
                "allowed_values": allowed_values,
                "dataset_metadata": {"yah": "nah"},
                "short_name": "m1",
                "description": "a dataset",
                "version": "v1",
            },
            headers=headers,
        )
        assert categorical_matrix_dataset.status_code == status_code

    def _setup_types(self, client, admin_headers):
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
                "taiga_id": None,
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

    def test_list_strings_dataset_uploads_task(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        private_group: Dict,
        mock_celery,
        monkeypatch,
    ):
        user = "someone@private-group.com"
        headers = {"X-Forwarded-User": user}

        # Test list of strings matrix
        file = factories.matrix_csv_data_file_with_values(
            values=[
                '["V600E","P9095","N405R"]',
                '["V600E","P9095"]',
                pd.NA,
                None,
                '["G586T","P858R","Q725Z","J356W"]',
                np.nan,
            ]
        )
        file_ids, expected_md5 = upload_and_get_file_ids(client, file)
        ls_dataset_given_id = "some_given_id"

        list_strings_matrix_dataset = client.post(
            "/dataset-v2/",
            json={
                "format": "matrix",
                "name": "List String Dataset",
                "given_id": ls_dataset_given_id,
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "file_ids": file_ids,
                "dataset_md5": expected_md5,
                "is_transient": False,
                "group_id": private_group["id"],
                "value_type": "list_strings",
                "dataset_metadata": {"yah": "nah"},
                "short_name": "shortie",
                "description": "a dataset",
                "version": "v1",
            },
            headers=headers,
        )
        assert_status_ok(list_strings_matrix_dataset)
        assert list_strings_matrix_dataset.status_code == 202
        assert list_strings_matrix_dataset.json()["state"] == "SUCCESS"
        assert list_strings_matrix_dataset.json()["result"]["datasetId"]
        list_strings_matrix_dataset_result = list_strings_matrix_dataset.json()[
            "result"
        ]["dataset"]
        assert list_strings_matrix_dataset_result is not None
        assert list_strings_matrix_dataset_result.get("given_id") == ls_dataset_given_id

        # Read out list of string with NAs dataset values
        matrix_subset = client.post(
            f"/datasets/matrix/{ls_dataset_given_id}",
            json={
                "features": ["A", "C"],
                "feature_identifier": "id",
                "samples": ["ACH-1", "ACH-2"],
                "sample_identifier": "id",
            },
            headers=headers,
        )
        assert_status_ok(matrix_subset)
        matrix_subset_result = matrix_subset.json()
        assert matrix_subset_result == {
            "A": {"ACH-1": ["V600E", "P9095", "N405R"], "ACH-2": None},
            "C": {"ACH-1": None, "ACH-2": None},
        }

    def test_list_strings_sparse_dataset_uploads_task(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        private_group: Dict,
        mock_celery,
        monkeypatch,
    ):
        user = "someone@private-group.com"
        headers = {"X-Forwarded-User": user}

        # Test sparse list of strings matrix
        file = factories.matrix_csv_data_file_with_values(
            values=[
                '["V600E","P9095","N405R"]',
                pd.NA,
                pd.NA,
                None,
                '["G586T","P858R","Q725Z","J356W"]',
                np.nan,
            ]
        )
        file_ids, expected_md5 = upload_and_get_file_ids(client, file)
        ls_dataset_given_id = "some_given_id"

        list_strings_matrix_dataset = client.post(
            "/dataset-v2/",
            json={
                "format": "matrix",
                "name": "List String Dataset",
                "given_id": ls_dataset_given_id,
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "file_ids": file_ids,
                "dataset_md5": expected_md5,
                "is_transient": False,
                "group_id": private_group["id"],
                "value_type": "list_strings",
                "dataset_metadata": {"yah": "nah"},
                "short_name": "shortie",
                "description": "a dataset",
                "version": "v1",
            },
            headers=headers,
        )
        assert_status_ok(list_strings_matrix_dataset)
        assert list_strings_matrix_dataset.status_code == 202
        assert list_strings_matrix_dataset.json()["state"] == "SUCCESS"
        assert list_strings_matrix_dataset.json()["result"]["datasetId"]
        list_strings_matrix_dataset_result = list_strings_matrix_dataset.json()[
            "result"
        ]["dataset"]
        assert list_strings_matrix_dataset_result is not None
        assert list_strings_matrix_dataset_result.get("given_id") == ls_dataset_given_id

        # Read out list of string with NAs dataset values
        matrix_subset = client.post(
            f"/datasets/matrix/{ls_dataset_given_id}",
            json={
                "features": ["A", "C"],
                "feature_identifier": "id",
                "samples": ["ACH-1", "ACH-2"],
                "sample_identifier": "id",
            },
            headers=headers,
        )
        assert_status_ok(matrix_subset)
        matrix_subset_result = matrix_subset.json()
        assert matrix_subset_result == {
            "A": {"ACH-1": ["V600E", "P9095", "N405R"], "ACH-2": None},
            "C": {"ACH-1": None, "ACH-2": None},
        }

    def test_add_matrix_dataset_with_dim_type_annotations(
        self,
        client: TestClient,
        minimal_db,
        private_group: Dict,
        settings,
        mock_celery,
    ):
        admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}
        self._setup_types(client, admin_headers)

        file = factories.continuous_matrix_csv_file()
        file_ids, expected_md5 = upload_and_get_file_ids(client, file)

        # If no metadata given, validate against feature type and sample type metadata. If not found, provide warning
        r_matrix_dataset_no_metadata_for_feature = client.post(
            "/dataset-v2/",
            json={
                "format": "matrix",
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "gene",  # Metadata doesn't have feature 'C'
                "sample_type": "sample",
                "data_type": "User upload",
                "file_ids": file_ids,
                "dataset_md5": expected_md5,
                "is_transient": False,
                "group_id": private_group["id"],
                "value_type": "continuous",
                "allowed_values": None,
            },
            headers=admin_headers,
        )
        # Has warning
        assert_status_ok(r_matrix_dataset_no_metadata_for_feature)
        assert r_matrix_dataset_no_metadata_for_feature.json()["result"][
            "unknownIDs"
        ] == [{"dimensionType": "gene", "axis": "feature", "IDs": ["C"]}]

    def test_add_matrix_dataset_with_given_id_in_metadata(
        self,
        client: TestClient,
        minimal_db,
        private_group: Dict,
        settings,
        mock_celery,
    ):
        admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}
        self._setup_types(client, admin_headers)

        file = factories.continuous_matrix_csv_file()
        file_ids, expected_md5 = upload_and_get_file_ids(client, file)

        # Even though there's no given_id explicitely set, it should get populated from the metadata
        given_id = "some_given_id"
        matrix_dataset_response = client.post(
            "/dataset-v2/",
            json={
                "format": "matrix",
                "name": "a dataset",
                "units": "a unit",
                "feature_type": None,
                "sample_type": "sample",
                "data_type": "User upload",
                "file_ids": file_ids,
                "dataset_md5": expected_md5,
                "is_transient": False,
                "group_id": PUBLIC_GROUP_ID,
                "given_id": None,
                "dataset_metadata": {"legacy_dataset_id": given_id},
                "value_type": "continuous",
                "allowed_values": None,
            },
            headers=admin_headers,
        )

        assert_status_ok(matrix_dataset_response)
        matrix_dataset_result = matrix_dataset_response.json()["result"]["dataset"]
        assert matrix_dataset_result is not None
        assert matrix_dataset_result.get("given_id") == given_id

    def test_add_matrix_dataset_with_duplicate_ids_fails(
        self,
        client: TestClient,
        minimal_db,
        private_group: Dict,
        settings,
        mock_celery,
        tmpdir,
    ):
        """Uploading a dataset with duplicate column or row IDs should fail"""
        admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}
        self._setup_types(client, admin_headers)

        file_with_duplicate_features = factories.continuous_matrix_csv_file(
            feature_ids=["A", "B", "A", "C"], sample_ids=["A", "B", "C"],
        )
        file_ids, expected_md5 = upload_and_get_file_ids(
            client, file_with_duplicate_features
        )

        # This should fail because of the duplicate feature IDs
        matrix_dataset_response = client.post(
            "/dataset-v2/",
            json={
                "format": "matrix",
                "name": "a dataset",
                "units": "a unit",
                "feature_type": None,
                "sample_type": "sample",
                "data_type": "User upload",
                "file_ids": file_ids,
                "dataset_md5": expected_md5,
                "is_transient": False,
                "group_id": PUBLIC_GROUP_ID,
                "given_id": None,
                "dataset_metadata": {},
                "value_type": "continuous",
                "allowed_values": None,
            },
            headers=admin_headers,
        )
        assert matrix_dataset_response.status_code == 400

        file_with_duplicate_samples = factories.continuous_matrix_csv_file(
            feature_ids=["A", "B", "C"], sample_ids=["A", "B", "A", "C"],
        )
        file_ids, expected_md5 = upload_and_get_file_ids(
            client, file_with_duplicate_samples
        )

        # This should fail because of the duplicate sample IDs
        matrix_dataset_response = client.post(
            "/dataset-v2/",
            json={
                "format": "matrix",
                "name": "a dataset",
                "units": "a unit",
                "feature_type": None,
                "sample_type": "sample",
                "data_type": "User upload",
                "file_ids": file_ids,
                "dataset_md5": expected_md5,
                "is_transient": False,
                "group_id": PUBLIC_GROUP_ID,
                "given_id": None,
                "dataset_metadata": {},
                "value_type": "continuous",
                "allowed_values": None,
            },
            headers=admin_headers,
        )
        assert matrix_dataset_response.status_code == 400

    def test_add_tabular_dataset_with_dim_type_annotations(
        self,
        client: TestClient,
        minimal_db,
        private_group: Dict,
        settings,
        mock_celery,
    ):
        admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}
        self._setup_types(client, admin_headers)

        # Test tabular dataset
        tabular_data_file = factories.tabular_csv_data_file(
            cols=["sample_id", "attr1", "attr2", "attr3"],
            row_values=[["ACH-1", 1.0, 0, '["a"]'], ["ACH-3", 2.0, 1, '["d", "c"]']],
        )

        tabular_file_ids, expected_md5 = upload_and_get_file_ids(
            client, tabular_data_file
        )

        tabular_dataset = client.post(
            "/dataset-v2/",
            json={
                "format": "tabular",
                "name": "a table dataset",
                "index_type": "sample",
                "data_type": "User upload",
                "file_ids": tabular_file_ids,
                "dataset_md5": expected_md5,
                "is_transient": False,
                "group_id": private_group["id"],
                "dataset_metadata": {"yah": "nah"},
                "columns_metadata": {
                    "sample_id": {
                        "units": None,
                        "col_type": "text",
                        "references": "sample",
                    },
                    "attr1": {"units": "some units", "col_type": "continuous"},
                    "attr2": {"units": None, "col_type": "categorical"},
                    "attr3": {"units": None, "col_type": "list_strings"},
                },
            },
            headers=admin_headers,
        )
        assert_status_ok(tabular_dataset)
        assert tabular_dataset.status_code == 202

    def test_add_tabular_dataset_with_missing_vals(
        self,
        client: TestClient,
        minimal_db,
        private_group: Dict,
        settings,
        mock_celery,
    ):
        admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}
        self._setup_types(client, admin_headers)

        # Test tabular dataset
        tabular_data_file = factories.tabular_csv_data_file(
            cols=["sample_id", "attr1", "attr2", "attr3", "attr4", "attr5"],
            row_values=[
                ["ACH-1", 1.0, 0, np.NaN, np.NaN, "cat1"],
                ["ACH-3", np.NaN, np.NaN, '["d", "c"]', "oops", np.NaN],
            ],
        )

        tabular_file_ids, expected_md5 = upload_and_get_file_ids(
            client, tabular_data_file
        )

        tabular_dataset = client.post(
            "/dataset-v2/",
            json={
                "format": "tabular",
                "name": "a table dataset",
                "index_type": "sample",
                "data_type": "User upload",
                "file_ids": tabular_file_ids,
                "dataset_md5": expected_md5,
                "is_transient": False,
                "group_id": private_group["id"],
                "dataset_metadata": {"yah": "nah"},
                "columns_metadata": {
                    "sample_id": {
                        "units": None,
                        "col_type": "text",
                        "references": "sample",
                    },
                    "attr1": {"units": "some units", "col_type": "continuous"},
                    "attr2": {"units": None, "col_type": "categorical"},
                    "attr3": {"units": None, "col_type": "list_strings"},
                    "attr4": {"units": None, "col_type": "text"},
                    "attr5": {"units": None, "col_type": "categorical"},
                },
            },
            headers=admin_headers,
        )
        assert_status_ok(tabular_dataset)
        dataset_id = tabular_dataset.json()["result"]["datasetId"]
        ach3_vals = (
            minimal_db.query(TabularCell)
            .join(TabularColumn, TabularColumn.id == TabularCell.tabular_column_id)
            .join(TabularDataset, TabularDataset.id == TabularColumn.dataset_id)
            .filter(
                and_(
                    TabularDataset.id == dataset_id,
                    TabularCell.dimension_given_id == "ACH-3",
                )
            )
            .all()
        )
        assert len(ach3_vals) == 6
        ach3_missing_bool_val = (
            minimal_db.query(TabularCell)
            .join(TabularColumn, TabularColumn.id == TabularCell.tabular_column_id)
            .join(TabularDataset, TabularDataset.id == TabularColumn.dataset_id)
            .filter(
                and_(
                    TabularDataset.id == dataset_id,
                    TabularCell.dimension_given_id == "ACH-3",
                    TabularColumn.given_id == "attr2",
                )
            )
            .one()
        )
        assert ach3_missing_bool_val.value == None
        ach3_missing_cont_val = (
            minimal_db.query(TabularCell)
            .join(TabularColumn, TabularColumn.id == TabularCell.tabular_column_id)
            .join(TabularDataset, TabularDataset.id == TabularColumn.dataset_id)
            .filter(
                and_(
                    TabularDataset.id == dataset_id,
                    TabularCell.dimension_given_id == "ACH-3",
                    TabularColumn.given_id == "attr1",
                )
            )
            .one()
        )
        assert ach3_missing_cont_val.value == None
        ach3_nonmissing_val = (
            minimal_db.query(TabularCell)
            .join(TabularColumn, TabularColumn.id == TabularCell.tabular_column_id)
            .join(TabularDataset, TabularDataset.id == TabularColumn.dataset_id)
            .filter(
                and_(
                    TabularDataset.id == dataset_id,
                    TabularCell.dimension_given_id == "ACH-3",
                    TabularColumn.given_id == "attr3",
                )
            )
            .one()
        )
        assert ach3_nonmissing_val.value == '["d", "c"]'

        subsetted_by_id_res = client.post(
            f"/datasets/tabular/{dataset_id}",
            json={
                "indices": ["ACH-1"],
                "identifier": "id",
                "columns": ["attr2", "attr3", "attr4", "attr5"],
            },
            headers=admin_headers,
        )
        assert subsetted_by_id_res.status_code == 200
        expected_res = {
            "attr2": {"ACH-1": "0"},
            "attr3": {"ACH-1": None},
            "attr4": {"ACH-1": None},
            "attr5": {"ACH-1": "cat1"},
        }
        assert subsetted_by_id_res.json() == expected_res
        # subsetted_by_label_res = client.post(
        #     f"/datasets/tabular/{dataset_id}",
        #     json={
        #         "indices": ["cell line 1"],
        #         "identifier": "label",
        #         "columns": ["attr4", "attr5"],
        #     },
        #     headers=admin_headers,
        # )
        # expected_res = {'attr4': {'cell line 1': None}, 'attr5': {'cell line 1': 'cat1'}}
        # assert subsetted_by_label_res.json() == expected_res

    @pytest.mark.parametrize(
        "invalid_list_strings",
        [
            ('["d", "c"]', '["d", None]'),
            ('["d", "c"]', ' ["d", "c"]'),
            ('["d", "c"]', '["d", "c"] '),
            (np.NaN, False),
        ],
    )
    def test_add_tabular_dataset_with_invalid_list_str_vals(
        self,
        client: TestClient,
        minimal_db,
        private_group: Dict,
        settings,
        mock_celery,
        invalid_list_strings,
    ):
        admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}
        self._setup_types(client, admin_headers)

        # Test tabular dataset
        tabular_data_file = factories.tabular_csv_data_file(
            cols=["sample_id", "attr1", "attr2", "attr3", "attr4", "attr5"],
            row_values=[
                ["ACH-1", 1.0, 0, invalid_list_strings[0], np.NaN, "cat1"],
                ["ACH-3", np.NaN, np.NaN, invalid_list_strings[1], "oops", np.NaN],
            ],
        )

        tabular_file_ids, expected_md5 = upload_and_get_file_ids(
            client, tabular_data_file
        )

        tabular_dataset = client.post(
            "/dataset-v2/",
            json={
                "format": "tabular",
                "name": "a table dataset",
                "index_type": "sample",
                "data_type": "User upload",
                "file_ids": tabular_file_ids,
                "dataset_md5": expected_md5,
                "is_transient": False,
                "group_id": private_group["id"],
                "dataset_metadata": {"yah": "nah"},
                "columns_metadata": {
                    "sample_id": {
                        "units": None,
                        "col_type": "text",
                        "references": "sample",
                    },
                    "attr1": {"units": "some units", "col_type": "continuous"},
                    "attr2": {"units": None, "col_type": "categorical"},
                    "attr3": {"units": None, "col_type": "list_strings"},
                    "attr4": {"units": None, "col_type": "text"},
                    "attr5": {"units": None, "col_type": "categorical"},
                },
            },
            headers=admin_headers,
        )
        assert tabular_dataset.status_code == 400


import json
import pandas as pd
from breadbox.models.dataset import AnnotationType
from fastapi.testclient import TestClient
from breadbox.schemas.dataset import ColumnMetadata
from breadbox.crud.access_control import PUBLIC_GROUP_ID
from tests import factories


def test_end_to_end_with_mismatched_metadata(
    client: TestClient, minimal_db, settings, mock_celery
):
    # create a matrix dataset with new feature and sample metadata
    # but the feature metadata and sample metadata don't perfectly match
    # matrix. Make sure fetching data gracefully handles these cases.
    db = minimal_db
    admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}

    # first create metadata. Using the api instead of factory methods because
    # this is intended as an integration test, verifying that the whole flow works
    # appropriately.
    def create_dim_type(axis):
        type_name = f"{axis}_name"
        display_name = f"{axis} Name"
        id_column = f"{axis}_id"
        prefix = axis[0].upper()

        dim_type_fields = {
            "name": type_name,
            "display_name": display_name,
            "axis": axis,
            "id_column": id_column,
        }
        response = client.post(
            "/types/dimensions", json=dim_type_fields, headers=admin_headers,
        )
        assert_status_ok(response)

        # now add a metadata table
        # now, update the metadata
        new_metadata = factories.tabular_dataset(
            db,
            settings,
            columns_metadata={
                "label": ColumnMetadata(units=None, col_type=AnnotationType.text),
                id_column: ColumnMetadata(units=None, col_type=AnnotationType.text),
            },
            index_type_name=type_name,
            data_df=pd.DataFrame(
                {
                    id_column: [f"{prefix}ID-1", f"{prefix}ID-2", f"{prefix}ID-3",],
                    "label": [f"{prefix}L-1", f"{prefix}L-2", f"{prefix}L-3"],
                }
            ),
        )

        response = client.patch(
            f"/types/dimensions/{type_name}",
            json=(
                {
                    "metadata_dataset_id": new_metadata.id,
                    "properties_to_index": ["label"],
                }
            ),
            headers=admin_headers,
        )
        assert_status_ok(response)

    # create a feature type and sample type with three records (SID-1, SID-2, SID-3, FID-1, FID-2, FID-3)
    create_dim_type("feature")
    create_dim_type("sample")

    # now create a matrix indexed by those types, but has some IDs mismatch the dim type
    matrix_df = pd.DataFrame(
        {"FID-3": [1, 2, 3], "FID-1": [4, 5, 6], "FID-X": [7, 8, 9]},
        index=["SID-3", "SID-X", "SID-1"],
    )
    file = io.BytesIO(matrix_df.to_csv().encode("utf8"))

    file_ids, expected_md5 = upload_and_get_file_ids(client, file)

    matrix_dataset = client.post(
        "/dataset-v2/",
        json={
            "format": "matrix",
            "name": "a dataset",
            "units": "a unit",
            "feature_type": "feature_name",
            "sample_type": "sample_name",
            "data_type": "User upload",
            "file_ids": file_ids,
            "dataset_md5": expected_md5,
            "is_transient": False,
            "group_id": PUBLIC_GROUP_ID,
            "value_type": "continuous",
            "allowed_values": None,
        },
        headers=admin_headers,
    )
    assert_status_ok(matrix_dataset)
    assert matrix_dataset.status_code == 202
    result_json = matrix_dataset.json()
    assert result_json["state"] == "SUCCESS"
    dataset_id = result_json["result"]["datasetId"]
    assert dataset_id is not None
    assert sorted(result_json["result"]["unknownIDs"], key=lambda x: x["axis"]) == [
        {"dimensionType": "feature_name", "axis": "feature", "IDs": ["FID-X"]},
        {"dimensionType": "sample_name", "axis": "sample", "IDs": ["SID-X"]},
    ]

    # TODO: Delete after deprecated endpoint is deleted
    result = client.post(
        f"/datasets/data/{dataset_id}",
        json={"features": ["FID-1", "FID-2", "FID-3"], "feature_identifier": "id",},
    )
    assert_status_ok(result)
    # two points in this response that I'm not sure about:
    # 1. since we requested FID-2, should this response include a FID-2 with no values?
    # 2. this is returning samples (SID-X) which are not included in the metadata. Should breadbox filter these out before returning the result?
    assert result.json() == {
        "FID-1": {"SID-1": 6.0, "SID-X": 5.0, "SID-3": 4.0},
        "FID-3": {"SID-1": 3.0, "SID-X": 2.0, "SID-3": 1.0},
    }

    result = client.post(
        f"/datasets/matrix/{dataset_id}",
        json={"features": ["FID-1", "FID-2", "FID-3"], "feature_identifier": "id",},
    )
    assert_status_ok(result)
    # two points in this response that I'm not sure about:
    # 1. since we requested FID-2, should this response include a FID-2 with no values?
    # 2. this is returning samples (SID-X) which are not included in the metadata. Should breadbox filter these out before returning the result?
    assert result.json() == {
        "FID-1": {"SID-1": 6.0, "SID-X": 5.0, "SID-3": 4.0},
        "FID-3": {"SID-1": 3.0, "SID-X": 2.0, "SID-3": 1.0},
    }
