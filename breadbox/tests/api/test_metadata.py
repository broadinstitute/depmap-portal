from numpy import nan
from breadbox.models.dataset import ValueType
from breadbox.schemas.types import AnnotationType
from tests import factories
from fastapi.testclient import TestClient
import json

from breadbox.db.session import SessionWithUser
from breadbox.schemas.types import AnnotationTypeMap
from ..utils import assert_status_ok, assert_status_not_ok


class TestGet:
    feature_attr1_title = "label"
    feature_attr1_value1 = "a"
    feature_attr1_value2 = "b"

    feature_attr2_title = "attr2"
    feature_attr2_value1 = 1.0
    feature_attr2_value2 = 2.0

    feature_attr3_title = "attr3"
    feature_attr3_value1 = '["hi", "bye"]'
    feature_attr3_value2 = nan

    feature_attr4_title = "attr4"
    feature_attr4_value1 = "true"
    feature_attr4_value2 = 0

    feature_attr5_title = "attr5"
    feature_attr5_value1 = "Cat1"
    feature_attr5_value2 = "Cat2"

    feature_id_col = "entrez_id"
    feature_id_col_value1 = "A"
    feature_id_col_value2 = "B"

    sample_attr1_title = "label"
    sample_attr1_value1 = "a"
    sample_attr1_value2 = "b"

    sample_attr2_title = "attr2"
    sample_attr2_value1 = 1.0
    sample_attr2_value2 = 2.0

    sample_id_col = "depmap_id"
    sample_id_col_value1 = "ACH-1"
    sample_id_col_value2 = "ACH-2"

    def _setup_db(self, minimal_db, settings, user, group_id):
        feature_metadata_file = factories.tabular_csv_data_file(
            cols=[
                self.feature_attr1_title,
                self.feature_id_col,
                self.feature_attr2_title,
                self.feature_attr3_title,
                self.feature_attr4_title,
                self.feature_attr5_title,
            ],
            row_values=[
                [
                    self.feature_attr1_value1,
                    self.feature_id_col_value1,
                    self.feature_attr2_value1,
                    self.feature_attr3_value1,
                    self.feature_attr4_value1,
                    self.feature_attr5_value1,
                ],
                [
                    self.feature_attr1_value2,
                    self.feature_id_col_value2,
                    self.feature_attr2_value2,
                    self.feature_attr3_value2,
                    self.feature_attr4_value2,
                    self.feature_attr5_value2,
                ],
            ],
        )

        sample_metadata_file = factories.tabular_csv_data_file(
            cols=[self.sample_attr1_title, self.sample_id_col, self.sample_attr2_title],
            row_values=[
                [
                    self.sample_attr1_value1,
                    self.sample_id_col_value1,
                    self.sample_attr2_value1,
                ],
                [
                    self.sample_attr1_value2,
                    self.sample_id_col_value2,
                    self.sample_attr2_value2,
                ],
            ],
        )

        sample_annotation_type_mapping = {
            self.sample_attr1_title: AnnotationType.text,
            self.sample_attr2_title: AnnotationType.continuous,
            self.sample_id_col: AnnotationType.text,
        }

        feature_annotation_type_mapping = {
            self.feature_attr1_title: AnnotationType.text,
            self.feature_attr2_title: AnnotationType.continuous,
            self.feature_attr3_title: AnnotationType.list_strings,
            self.feature_attr4_title: AnnotationType.categorical,
            self.feature_attr5_title: AnnotationType.categorical,
            self.feature_id_col: AnnotationType.text,
        }

        feature_metadata = factories.feature_type_with_metadata(
            db=minimal_db,
            settings=settings,
            name="gene",
            id_column=self.feature_id_col,
            metadata_file=feature_metadata_file,
            annotation_type_mapping=AnnotationTypeMap(
                annotation_type_mapping=feature_annotation_type_mapping
            ),
            user=user,
        )

        sample_metadata = factories.sample_type_with_metadata(
            db=minimal_db,
            settings=settings,
            name="test",
            id_column=self.sample_id_col,
            metadata_file=sample_metadata_file,
            annotation_type_mapping=AnnotationTypeMap(
                annotation_type_mapping=sample_annotation_type_mapping
            ),
            user=user,
        )

        dataset = factories.matrix_dataset(
            minimal_db,
            settings,
            group=group_id,
            data_file=factories.matrix_csv_data_file_with_values(
                feature_ids=[self.feature_id_col_value1, self.feature_id_col_value2,],
                sample_ids=[self.sample_id_col_value1, self.sample_id_col_value2],
                values=[1.0, 2.0, 3.0],
            ),
            value_type=ValueType.continuous,
        )

    def test_no_metadata(self, client: TestClient):
        response = client.get(
            "/metadata",
            params={"label_or_id": "SOX10"},
            headers={"X-Forwarded-User": "anyone"},
        )
        assert_status_ok(response)
        assert response.json()["metadata"] == []

    def test_get_metadata(
        self, client: TestClient, minimal_db: SessionWithUser, public_group, settings
    ):
        user = settings.admin_users[0]

        self._setup_db(
            minimal_db=minimal_db,
            settings=settings,
            user=user,
            group_id=public_group.id,
        )

        r_feature_1 = client.get(
            "/metadata", params={"label_or_id": self.feature_id_col_value1}
        )
        result = r_feature_1.json()
        expected_result = {
            "label": self.feature_id_col_value1,
            "metadata": [
                {
                    "given_id": self.feature_attr3_title,
                    "value": ["hi", "bye"],
                    "annotation_type": "list_strings",
                },
                {
                    "given_id": self.feature_attr4_title,
                    "value": "true",
                    "annotation_type": "categorical",
                },
                {
                    "given_id": self.feature_attr5_title,
                    "value": "Cat1",
                    "annotation_type": "categorical",
                },
                {
                    "given_id": self.feature_attr2_title,
                    "value": self.feature_attr2_value1,
                    "annotation_type": "continuous",
                },
                {
                    "given_id": self.feature_attr1_title,
                    "value": self.feature_attr1_value1,
                    "annotation_type": "text",
                },
                {
                    "given_id": self.feature_id_col,
                    "value": self.feature_id_col_value1,
                    "annotation_type": "text",
                },
            ],
        }

        assert result["label"] == expected_result["label"]
        assert len(result["metadata"]) == len(expected_result["metadata"])
        assert all(meta in expected_result["metadata"] for meta in result["metadata"])

        r_feature_2 = client.get(
            "/metadata", params={"label_or_id": self.feature_id_col_value2}
        )
        result2 = r_feature_2.json()

        expected_result2 = {
            "label": self.feature_id_col_value2,
            "metadata": [
                {
                    "given_id": self.feature_id_col,
                    "value": self.feature_id_col_value2,
                    "annotation_type": "text",
                },
                {
                    "given_id": self.feature_attr3_title,
                    "value": None,
                    "annotation_type": "list_strings",
                },
                {
                    "given_id": self.feature_attr4_title,
                    "value": "0",
                    "annotation_type": "categorical",
                },
                {
                    "given_id": self.feature_attr5_title,
                    "value": "Cat2",
                    "annotation_type": "categorical",
                },
                {
                    "given_id": self.feature_attr2_title,
                    "value": self.feature_attr2_value2,
                    "annotation_type": "continuous",
                },
                {
                    "given_id": self.feature_attr1_title,
                    "value": self.feature_attr1_value2,
                    "annotation_type": "text",
                },
            ],
        }

        assert result2["label"] == expected_result2["label"]
        assert len(result2["metadata"]) == len(expected_result2["metadata"])
        assert all(meta in expected_result2["metadata"] for meta in result2["metadata"])

        r_sample_1 = client.get(
            "/metadata", params={"label_or_id": self.sample_id_col_value1}
        )
        result3 = r_sample_1.json()

        expected_result3 = {
            "label": self.sample_id_col_value1,
            "metadata": [
                {
                    "given_id": self.sample_id_col,
                    "value": self.sample_id_col_value1,
                    "annotation_type": "text",
                },
                {
                    "given_id": self.sample_attr2_title,
                    "value": self.sample_attr2_value1,
                    "annotation_type": "continuous",
                },
                {
                    "given_id": self.sample_attr1_title,
                    "value": self.sample_attr1_value1,
                    "annotation_type": "text",
                },
            ],
        }

        assert result3["label"] == expected_result3["label"]
        assert len(result3["metadata"]) == len(expected_result3["metadata"])
        assert all(meta in expected_result3["metadata"] for meta in result3["metadata"])

        r_sample_2 = client.get(
            "/metadata", params={"label_or_id": self.sample_id_col_value2}
        )

        result4 = r_sample_2.json()

        expected_result4 = {
            "label": self.sample_id_col_value2,
            "metadata": [
                {
                    "given_id": self.sample_id_col,
                    "value": self.sample_id_col_value2,
                    "annotation_type": "text",
                },
                {
                    "given_id": self.sample_attr2_title,
                    "value": self.sample_attr2_value2,
                    "annotation_type": "continuous",
                },
                {
                    "given_id": self.sample_attr1_title,
                    "value": self.sample_attr1_value2,
                    "annotation_type": "text",
                },
            ],
        }

        assert result4["label"] == expected_result4["label"]
        assert len(result4["metadata"]) == len(expected_result4["metadata"])
        assert all(meta in expected_result4["metadata"] for meta in result4["metadata"])

    def test_search_metadata_via_nav_search_bar(
        self, client: TestClient, minimal_db: SessionWithUser, public_group, settings
    ):
        user = settings.admin_users[0]
        public_headers = {"X-Forwarded-User": "anyone"}

        self._setup_db(
            minimal_db=minimal_db,
            settings=settings,
            user=user,
            group_id=public_group.id,
        )
        minimal_db.commit()

        # Test results we know exist
        search_starts_with_a = client.get(
            "/metadata/search", headers=public_headers, params={"text": "a"}
        )
        result_starts_with_a = search_starts_with_a.json()
        assert result_starts_with_a == {"labels": ["A", "ACH-1", "ACH-2"]}

        # Test as if the user continues typing, filtering "A" out of the result list.
        # This also mimics returning ONLY samples
        search_starts_with_ach = client.get(
            "/metadata/search", headers=public_headers, params={"text": "ach"}
        )
        result_starts_with_ach = search_starts_with_ach.json()
        assert result_starts_with_ach == {"labels": ["ACH-1", "ACH-2"]}

        # Test a search that will only return results for a feature
        search_starts_with_b = client.get(
            "/metadata/search", headers=public_headers, params={"text": "b"}
        )
        result_starts_with_b = search_starts_with_b.json()
        assert result_starts_with_b == {"labels": ["B"]}

        # Test results we know will be empty
        search_starts_with_q = client.get(
            "/metadata/search", headers=public_headers, params={"text": "q"}
        )
        result_starts_with_q = search_starts_with_q.json()
        assert result_starts_with_q == {"labels": []}

    def test_search_metadata_privacy(
        self, client: TestClient, minimal_db: SessionWithUser, private_group, settings
    ):
        user = settings.admin_users[0]

        self._setup_db(
            minimal_db=minimal_db,
            settings=settings,
            user=user,
            group_id=private_group["id"],
        )
        minimal_db.commit()

        public_headers = {"X-Forwarded-User": "anyone"}

        # Test results we know exist, but were added privately. A public user
        # should not see any search options returned.
        public_search = client.get(
            "/metadata/search", headers=public_headers, params={"text": "ach"}
        )
        result_public_search = public_search.json()
        assert result_public_search == {"labels": []}

        # Make sure private users are able to see private search options.
        private_headers = {"X-Forwarded-User": "someone@private-group.com"}

        private_search = client.get(
            "/metadata/search", headers=private_headers, params={"text": "ach"}
        )
        result_private_search = private_search.json()
        assert result_private_search == {"labels": ["ACH-1", "ACH-2"]}
