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


def test_get_matrix_dataset_data_by_given_id(
    client: TestClient, minimal_db: SessionWithUser, settings, mock_celery
):
    factories.sample_type(
        minimal_db, settings.admin_users[0], "model", given_ids=["ACH-1", "ACH-2"]
    )
    given_id = "dataset_given_id"
    factories.matrix_dataset(
        minimal_db, settings, feature_type=None, sample_type="model", given_id=given_id,
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
    client: TestClient, minimal_db: SessionWithUser, settings, mock_celery
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
    client: TestClient, minimal_db: SessionWithUser, settings, mock_celery
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
    client: TestClient, minimal_db: SessionWithUser, settings, mock_celery
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
    client: TestClient, minimal_db: SessionWithUser, settings, mock_celery
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
    client: TestClient,
    minimal_db: SessionWithUser,
    settings,
    mock_celery,
    public_group,
    tmpdir,
):
    factories.sample_type(
        minimal_db, settings.admin_users[0], "model", given_ids=["Id1", "Id2", "Id3"],
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
    assert response.json() == {"25%tile": {"A": 1.5, "B": 3.25, "C": 2.5}}

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

    assert_status_ok(r_add_metadata_for_depmap_model)

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
    tabular_dataset_1_id = tabular_dataset_1_response.json()["result"]["dataset"]["id"]

    tabular_dataset_1 = (
        minimal_db.query(Dataset).filter_by(id=tabular_dataset_1_id).one()
    )
    assert tabular_dataset_1

    # Get a subset of the tabular dataset by id
    res = client.post(
        f"/datasets/tabular/{tabular_dataset_1_id}",
        json={"indices": ["ACH-2"], "identifier": "id", "columns": ["col_1", "col_2"],},
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
    tabular_dataset_2_id = tabular_dataset_2_response.json()["result"]["dataset"]["id"]

    tabular_dataset_2 = (
        minimal_db.query(Dataset).filter_by(id=tabular_dataset_2_id).one()
    )
    assert tabular_dataset_2

    # Get a subset of the tabular dataset by id
    res = client.post(
        f"/datasets/tabular/{tabular_dataset_2_id}",
        json={"indices": ["ACH-1"], "identifier": "id", "columns": ["col_1", "col_2"],},
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
    client: TestClient, minimal_db: SessionWithUser, public_group, settings,
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
    client: TestClient, minimal_db: SessionWithUser, public_group, settings,
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
