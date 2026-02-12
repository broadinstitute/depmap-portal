import sqlglot
from typing import Callable
from breadbox.db.session import SessionWithUser
from breadbox.models.dataset import AnnotationType
from tests import factories
import pandas as pd
from fastapi.testclient import TestClient


def _assert_sql_result_eq(client, sql, expected_result, expected_status_code=200):
    response = client.post(
        "/temp/sql/query",
        json={"sql": sql,},
        headers={"X-Forwarded-User": "anonymous"},
    )
    assert response.status_code == expected_status_code
    if isinstance(expected_result, Callable):
        assert expected_result(response.text)
    else:
        assert response.text == expected_result


def test_matrix_query(minimal_db: SessionWithUser, settings, client: TestClient):
    sample_ids = ["s1", "s2", "s3"]
    factories.sample_type(
        minimal_db, minimal_db.user, "simple_sample_type", given_ids=sample_ids
    )

    factories.matrix_dataset(
        minimal_db,
        settings,
        sample_type="simple_sample_type",
        feature_type=None,
        data_file=factories.matrix_csv_data_file_with_values(
            feature_ids=["A", "B"],
            sample_ids=sample_ids,
            values=[[1, 2], [3, 4], [5, 6]],
        ),
        dataset_name="simple_matrix",
    )

    assert_schema_is_valid(client)

    _assert_sql_result_eq(
        client, "select count(1) samples from simple_matrix_sample", "samples\r\n3\r\n"
    )

    _assert_sql_result_eq(
        client,
        "select count(1) features from simple_matrix_sample where sample_id = 's2'",
        "features\r\n1\r\n",
    )

    _assert_sql_result_eq(
        client,
        "select count(1) features from simple_matrix_sample where sample_id = 's4'",
        "features\r\n0\r\n",
    )

    _assert_sql_result_eq(
        client,
        "select count(1) features from simple_matrix_feature",
        "features\r\n2\r\n",
    )

    _assert_sql_result_eq(
        client,
        "select count(1) features from simple_matrix_feature where feature_id = 'A'",
        "features\r\n1\r\n",
    )

    _assert_sql_result_eq(
        client,
        "select count(1) features from simple_matrix_feature where feature_id = 'C'",
        "features\r\n0\r\n",
    )

    _assert_sql_result_eq(
        client, "select sum(value) total from simple_matrix", "total\r\n21.0\r\n"
    )

    _assert_sql_result_eq(
        client,
        "select value from simple_matrix where sample_id = 's2' and feature_id = 'A'",
        "value\r\n3.0\r\n",
    )


def assert_schema_is_valid(client):
    response = client.get(
        "/temp/sql/schema", headers={"X-Forwarded-User": "anonymous"},
    )
    assert response.status_code == 200

    response_content: dict = response.json()
    for _, schema in response_content.items():
        # make sure we can parse the resulting SQL that describes the schema
        parsed = sqlglot.parse(schema, dialect="sqlite")
        assert len(parsed) > 0
        print(f"Schema:\n{schema}")


def test_bad_queries(minimal_db: SessionWithUser, settings, client: TestClient):
    # malformed query
    _assert_sql_result_eq(
        client,
        "select count(1) samples from",
        lambda text: "Expected table name" in text,
        expected_status_code=400,
    )

    # query a table which doesn't exist
    _assert_sql_result_eq(
        client,
        "select count(1) samples from invalid",
        lambda text: "no such table: invalid" in text,
        expected_status_code=400,
    )


def test_tabular_query(minimal_db: SessionWithUser, settings, client: TestClient):
    # Define metadata
    factories.add_dimension_type(
        minimal_db,
        settings,
        user=settings.admin_users[0],
        name="annot1",
        display_name="annot1",
        id_column="ID",
        annotation_type_mapping={
            "ID": AnnotationType.text,
            "label": AnnotationType.text,
            "age": AnnotationType.continuous,
        },
        units_per_column={"age": "years"},
        axis="feature",
        metadata_df=pd.DataFrame(
            {
                "ID": ["1", "2", "5"],
                "label": ["featureLabel1", "featureLabel2", "featureLabel5"],
                "age": [10, 20, 3],
            }
        ),
    )

    factories.add_dimension_type(
        minimal_db,
        settings,
        user=settings.admin_users[0],
        name="annot2",
        display_name="annot2",
        id_column="ID",
        annotation_type_mapping={
            "ID": AnnotationType.text,
            "label": AnnotationType.text,
        },
        units_per_column={"age": "years"},
        axis="feature",
        metadata_df=pd.DataFrame({"ID": ["1", "5"], "label": ["dim2-1", "dim2-5"],}),
    )

    assert_schema_is_valid(client)

    _assert_sql_result_eq(
        client,
        "select max(label) max_label from annot1_metadata",
        "max_label\r\nfeatureLabel5\r\n",
    )

    # make sure that continuous values are really treated as continuous values and not strings
    _assert_sql_result_eq(
        client, "select max(age) max_age from annot1_metadata", "max_age\r\n20.0\r\n"
    )

    # make sure join works
    _assert_sql_result_eq(
        client,
        'select a1.label "label1", a2.label "label2" from annot1_metadata a1 join annot2_metadata a2 on a1.ID = a2.ID order by a1.ID',
        "label1,label2\r\nfeatureLabel1,dim2-1\r\nfeatureLabel5,dim2-5\r\n",
    )

    # make sure we handle fetching no rows correctly
    _assert_sql_result_eq(
        client, "select age from annot1_metadata where age > 10000", "age\r\n"
    )
