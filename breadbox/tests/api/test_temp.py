import numpy as np
import pandas as pd
from ..utils import assert_status_ok

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
