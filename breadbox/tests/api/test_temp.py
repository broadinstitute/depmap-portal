import numpy as np
import pandas as pd
from ..utils import assert_status_ok, assert_status_not_ok

from breadbox.db.session import SessionWithUser
from breadbox.models.dataset import AnnotationType
from fastapi.testclient import TestClient
from tests import factories


class TestPost:
    def test_evaluate_context(
        self, client: TestClient, minimal_db: SessionWithUser, public_group, settings,
    ):
        # Define label metadata for our features
        factories.add_dimension_type(
            minimal_db,
            settings,
            user=settings.admin_users[0],
            name="some_feature_type",
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

        # Define label metadata for our samples
        factories.add_dimension_type(
            minimal_db,
            settings,
            user=settings.admin_users[0],
            name="some_sample_type",
            display_name="Sample With Metadata",
            id_column="ID",
            annotation_type_mapping={
                "ID": AnnotationType.text,
                "label": AnnotationType.text,
            },
            axis="sample",
            metadata_df=pd.DataFrame(
                {
                    "ID": ["sampleID1", "sampleID2", "sampleID3"],
                    "label": ["sampleLabel1", "sampleLabel2", "sampleLabel3"],
                }
            ),
        )

        # Define a matrix dataset
        example_matrix_values = factories.matrix_csv_data_file_with_values(
            feature_ids=["featureID1", "featureID2", "featureID3"],
            sample_ids=["sampleID1", "sampleID2", "sampleID3"],
            values=np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]]),
        )
        dataset_given_id = "dataset_123"
        dataset_with_metadata = factories.matrix_dataset(
            minimal_db,
            settings,
            feature_type="some_feature_type",
            sample_type="some_sample_type",
            data_file=example_matrix_values,
            given_id=dataset_given_id,
        )

        # Test get by feature ID
        response = client.post(
            "/temp/context",
            json={
                "dimension_type": "some_feature_type",
                "name": "feature 2",
                "expr": {"==": [{"var": "given_id"}, "featureID2"]},
            },
            headers={"X-Forwarded-User": "some-public-user"},
        )

        assert_status_ok(response)
        response_content = response.json()
        assert response_content is not None
        assert response_content["ids"] == ["featureID2"]
        assert response_content["labels"] == ["featureLabel2"]
        assert response_content["num_candidates"] == 3

        # Test get by sample ID
        response = client.post(
            "/temp/context",
            json={
                "dimension_type": "some_sample_type",
                "name": "sample 1",
                "expr": {"==": [{"var": "given_id"}, "sampleID1"]},
            },
            headers={"X-Forwarded-User": "some-public-user"},
        )

        assert_status_ok(response)
        response_content = response.json()
        assert response_content is not None
        assert response_content["ids"] == ["sampleID1"]
        assert response_content["labels"] == ["sampleLabel1"]
        assert response_content["num_candidates"] == 3

        # Test a single expression context
        response = client.post(
            "/temp/context",
            json={
                "dimension_type": "some_sample_type",
                "name": "value greater than",
                "expr": {">": [{"var": "feature_var"}, 2.1]},
                "vars": {
                    "feature_var": {
                        "dataset_id": dataset_given_id,
                        "identifier": "featureLabel2",
                        "identifier_type": "feature_label",
                    }
                },
            },
            headers={"X-Forwarded-User": "some-public-user"},
        )

        assert_status_ok(response)
        response_content = response.json()
        assert response_content is not None
        assert response_content["ids"] == ["sampleID2", "sampleID3"]
        assert response_content["labels"] == ["sampleLabel2", "sampleLabel3"]
        assert response_content["num_candidates"] == 3

        # Test a multi-expression context. Get features which have BOTH:
        # - a value > 4.5 in sample 2 (identified by ID)
        # - and a value < 8.5 in sample 3 (identified by label)
        response = client.post(
            "/temp/context",
            json={
                "dimension_type": "some_feature_type",
                "name": "dependency greater than",
                "expr": {
                    "and": [
                        {">": [{"var": "model1_var"}, 4.5]},  # 4, 5, 6
                        {"<": [{"var": "model2_var"}, 8.5]},  # 7, 8, 9
                    ]
                },
                "vars": {
                    "model1_var": {
                        "dataset_id": dataset_given_id,
                        "identifier": "sampleID2",
                        "identifier_type": "sample_id",
                    },
                    "model2_var": {
                        "dataset_id": dataset_given_id,
                        "identifier": "sampleLabel3",
                        "identifier_type": "sample_label",
                    },
                },
            },
            headers={"X-Forwarded-User": "some-public-user"},
        )

        assert_status_ok(response)
        response_content = response.json()
        assert response_content is not None
        assert response_content["ids"] == ["featureID2"]
        assert response_content["labels"] == ["featureLabel2"]
        assert response_content["num_candidates"] == 3

    def test_context_dataset_coverage(
        self, client: TestClient, minimal_db: SessionWithUser, public_group, settings,
    ):
        """
        The endpoint that lets a caller pick a dataset that actually has the
        data, rather than the highest-priority one that may have none of it.
        """
        factories.add_dimension_type(
            minimal_db,
            settings,
            user=settings.admin_users[0],
            name="some_feature_type",
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
        factories.add_dimension_type(
            minimal_db,
            settings,
            user=settings.admin_users[0],
            name="some_sample_type",
            display_name="Sample",
            id_column="ID",
            annotation_type_mapping={
                "ID": AnnotationType.text,
                "label": AnnotationType.text,
            },
            axis="sample",
            metadata_df=pd.DataFrame(
                {
                    "ID": ["sampleID1", "sampleID2"],
                    "label": ["sampleLabel1", "sampleLabel2"],
                }
            ),
        )

        # Covers two of the three features.
        partial = factories.matrix_dataset(
            minimal_db,
            settings,
            feature_type="some_feature_type",
            sample_type="some_sample_type",
            data_file=factories.matrix_csv_data_file_with_values(
                feature_ids=["featureID1", "featureID2"],
                sample_ids=["sampleID1", "sampleID2"],
                values=np.array([[1, 2], [3, 4]]),
            ),
        )

        # Covers all three.
        complete = factories.matrix_dataset(
            minimal_db,
            settings,
            feature_type="some_feature_type",
            sample_type="some_sample_type",
            data_file=factories.matrix_csv_data_file_with_values(
                feature_ids=["featureID1", "featureID2", "featureID3"],
                sample_ids=["sampleID1", "sampleID2"],
                values=np.array([[1, 2, 3], [4, 5, 6]]),
            ),
        )

        everything = {
            "dimension_type": "some_feature_type",
            "name": "all features",
            "expr": True,
        }

        response = client.post(
            "/temp/context/dataset-coverage",
            json=everything,
            headers={"X-Forwarded-User": "some-public-user"},
        )

        assert_status_ok(response)
        content = response.json()

        assert content["total"] == 3
        assert content["counts"][complete.id] == 3
        # The point of the endpoint: this one is a worse match, and says so
        # rather than being indistinguishable from the other.
        assert content["counts"][partial.id] == 2

        # A context matching nothing any dataset carries. Datasets are omitted
        # rather than reported as zero, so the caller sees an empty map.
        response = client.post(
            "/temp/context/dataset-coverage",
            json={
                "dimension_type": "some_feature_type",
                "name": "nothing",
                "expr": {"==": [{"var": "given_id"}, "featureID-does-not-exist"]},
            },
            headers={"X-Forwarded-User": "some-public-user"},
        )

        assert_status_ok(response)
        assert response.json() == {"counts": {}, "total": 0}

        # Counts the sample axis when the dimension type lives there, rather
        # than always reaching for features.
        response = client.post(
            "/temp/context/dataset-coverage",
            json={
                "dimension_type": "some_sample_type",
                "name": "all samples",
                "expr": True,
            },
            headers={"X-Forwarded-User": "some-public-user"},
        )

        assert_status_ok(response)
        content = response.json()
        assert content["total"] == 2
        assert content["counts"][complete.id] == 2

    def test_context_dataset_coverage_respects_access(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        public_group,
        private_group,
        settings,
    ):
        """
        Counting has to go through the access-controlled dataset query. Counting
        over the dimension tables directly would be simpler and would report the
        contents of datasets the caller cannot see -- which is the one mistake
        this endpoint must not make, since it reports per-dataset numbers.
        """
        factories.add_dimension_type(
            minimal_db,
            settings,
            user=settings.admin_users[0],
            name="some_feature_type",
            display_name="Feature With Metadata",
            id_column="ID",
            annotation_type_mapping={
                "ID": AnnotationType.text,
                "label": AnnotationType.text,
            },
            axis="feature",
            metadata_df=pd.DataFrame(
                {
                    "ID": ["featureID1", "featureID2"],
                    "label": ["featureLabel1", "featureLabel2"],
                }
            ),
        )
        factories.add_dimension_type(
            minimal_db,
            settings,
            user=settings.admin_users[0],
            name="some_sample_type",
            display_name="Sample",
            id_column="ID",
            annotation_type_mapping={
                "ID": AnnotationType.text,
                "label": AnnotationType.text,
            },
            axis="sample",
            metadata_df=pd.DataFrame({"ID": ["sampleID1"], "label": ["sampleLabel1"]}),
        )

        data_file = factories.matrix_csv_data_file_with_values(
            feature_ids=["featureID1", "featureID2"],
            sample_ids=["sampleID1"],
            values=np.array([[1, 2]]),
        )

        secret = factories.matrix_dataset(
            minimal_db,
            settings,
            feature_type="some_feature_type",
            sample_type="some_sample_type",
            data_file=data_file,
            group=private_group["id"],
        )

        request = {
            "dimension_type": "some_feature_type",
            "name": "all features",
            "expr": True,
        }

        response = client.post(
            "/temp/context/dataset-coverage",
            json=request,
            headers={"X-Forwarded-User": "nobody@some-other-place.com"},
        )

        assert_status_ok(response)
        assert secret.id not in response.json()["counts"]

        # Visible to someone in the group, so the absence above is about access
        # rather than the dataset simply having no matching features.
        response = client.post(
            "/temp/context/dataset-coverage",
            json=request,
            headers={"X-Forwarded-User": "someone@private-group.com"},
        )

        assert_status_ok(response)
        assert response.json()["counts"][secret.id] == 2

    def test_evaluate_context_errors(
        self, client: TestClient, minimal_db: SessionWithUser, public_group, settings,
    ):
        """
        Test that errors are handled well when invalid requests are made
        (instead of just returning an empty set of matches).
        """
        # Define label metadata for our samples
        factories.add_dimension_type(
            minimal_db,
            settings,
            user=settings.admin_users[0],
            name="some_sample_type",
            display_name="Sample With Metadata",
            id_column="ID",
            annotation_type_mapping={
                "ID": AnnotationType.text,
                "label": AnnotationType.text,
            },
            axis="sample",
            metadata_df=pd.DataFrame(
                {
                    "ID": ["sampleID1", "sampleID2", "sampleID3"],
                    "label": ["sampleLabel1", "sampleLabel2", "sampleLabel3"],
                }
            ),
        )

        # Define a matrix dataset
        example_matrix_values = factories.matrix_csv_data_file_with_values(
            feature_ids=["featureID1", "featureID2", "featureID3"],
            sample_ids=["sampleID1", "sampleID2", "sampleID3"],
            values=np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]]),
        )
        dataset_given_id = "dataset_123"
        factories.matrix_dataset(
            minimal_db,
            settings,
            feature_type=None,
            sample_type="some_sample_type",
            data_file=example_matrix_values,
            given_id=dataset_given_id,
        )

        # Make sure an error is thrown when a variable isn't defined in the request
        # Should return a Bad Request error with a message like "Encountered lookup error: 'some_var_that_doesnt_exist'"
        response = client.post(
            "/temp/context",
            json={
                "dimension_type": "some_sample_type",
                "name": "value greater than",
                "expr": {">": [{"var": "some_var_that_doesnt_exist"}, 2.1]},
                "vars": {},
            },
            headers={"X-Forwarded-User": "some-public-user"},
        )
        assert_status_not_ok(response)
        assert response.status_code == 400

        # Make sure an error is thrown when a slice doesn't exist in our database
        # should return a message like "Sample given ID 'this sample does not exist!' not found in dataset 'dataset_123'."
        response = client.post(
            "/temp/context",
            json={
                "dimension_type": "some_sample_type",
                "name": "value greater than",
                "expr": {">": [{"var": "var_thats_not_in_db"}, 2.1]},
                "vars": {
                    "var_thats_not_in_db": {
                        "dataset_id": dataset_given_id,
                        "identifier": "this sample does not exist!",
                        "identifier_type": "sample_id",
                    },
                },
            },
            headers={"X-Forwarded-User": "some-public-user"},
        )
        assert_status_not_ok(response)
        assert response.status_code == 404


def test_cas_operations(client: TestClient, settings):
    # make sure we handle missing keys with a 404
    response = client.get("/temp/cas/asdfasdf",)
    assert response.status_code == 404

    # make sure storing and getting results in same value
    value = "payload"
    response = client.post("/temp/cas", json={"value": value,},)
    assert response.status_code == 200
    key = response.json()["key"]

    response = client.get(f"/temp/cas/{key}",)
    assert response.status_code == 200
    assert response.json()["value"] == value

    # make sure storing a different value results in a different key
    value2 = "different"
    response = client.post("/temp/cas", json={"value": value2,},)
    assert response.status_code == 200
    key2 = response.json()["key"]

    assert key != key2

    response = client.get(f"/temp/cas/{key2}",)
    assert response.status_code == 200
    assert response.json()["value"] == value2
