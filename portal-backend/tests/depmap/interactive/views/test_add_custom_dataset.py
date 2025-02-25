import json

import tempfile
from multidict import MultiDict
import pandas as pd
from json import loads as json_loads
from werkzeug.datastructures import FileStorage
import pytest
from flask import url_for

from depmap import data_access
from depmap.vector_catalog.trees import InteractiveTree
from depmap.vector_catalog.models import SliceSerializer, SliceRowType
from depmap.interactive.nonstandard.models import CustomDatasetConfig
from tests.factories import CellLineFactory
from tests.depmap.interactive.fixtures import (
    mock_taiga_client_feature,
    mock_taiga_client_length,
    custom_csv_upload_file_path,
    custom_csv_feature,
    custom_csv_plot_points_length,
    custom_csv_one_row_upload_file_path,
)
from tests.utilities.df_test_utils import load_sample_cell_lines


# fixme test that taiga dataset is not double pulled and copied over


def test_add_invalid_custom_taiga_dataset(
    empty_db_mock_downloads, mock_taiga_client, mock_celery_task_update_state,
):
    taiga_id = "invalid_taiga_id"
    transposed = "false"
    dropdown_label = "test dropdown label"
    units = "test axis label"

    args = {
        "taigaId": taiga_id,
        "displayName": dropdown_label,
        "units": units,
        "transposed": transposed,
    }

    with empty_db_mock_downloads.app.test_client() as c:
        r = c.post(
            url_for("interactive.add_custom_taiga_dataset"),
            data=json.dumps(args),
            headers={"content-type": "application/json"},
        )

        response = json.loads(r.data.decode("utf8"))
        assert response["state"] == "FAILURE"
        assert response["message"]


def test_full_custom_taiga_workflow(
    app, empty_db_mock_downloads, mock_taiga_client, mock_celery_task_update_state
):
    """
    Test that after posting a custom dataset:
    Can find matching features
    The dataset was pulled
    Can get plot points
    """
    with app.test_client() as c:
        # Add custom dataset
        args = {
            "taigaId": "test_taiga_id.1",
            "displayName": "dropdown label",
            "units": "axis label",
            "transposed": "true",
        }
        load_sample_cell_lines()
        r = c.post(
            url_for("interactive.add_custom_taiga_dataset"),
            data=json.dumps(args),
            headers={"content-type": "application/json"},
        )
        assert r.status_code == 200
        response = json.loads(r.data.decode("utf8"))
        assert "datasetId" in response["result"]
        dataset_id = response["result"]["datasetId"]

        # Test that can get feature
        params = {
            "catalog": "continuous",
            "id": "custom_dataset/" + dataset_id,
            "prefix": mock_taiga_client_feature,
        }
        r = c.get(url_for("vector_catalog.catalog_children", **params))
        assert r.status_code == 200
        response = json.loads(r.data.decode("utf8"))

        assert {
            "id": SliceSerializer.encode_slice_id(
                dataset_id, mock_taiga_client_feature, SliceRowType.label
            ),
            "childValue": mock_taiga_client_feature,
            "label": mock_taiga_client_feature,
            "terminal": True,
            "url": None,
            "group": None,
        } in response["children"]

        # Test that can get features
        params = MultiDict(
            [
                (
                    "features",
                    InteractiveTree.get_id_from_dataset_feature( # slice id for the feature
                        dataset_id, mock_taiga_client_feature
                    ),
                )
            ]
        )
        r = c.get(url_for("interactive.get_features", **params))
        assert r.status_code == 200
        response = json.loads(r.data.decode("utf8"))
        assert len(response["depmap_ids"]) == 1
        assert len(response["depmap_ids"]) == mock_taiga_client_length


def test_full_custom_csv_workflow(
    app, empty_db_mock_downloads, mock_celery_task_update_state
):
    """
    Test that after posting a custom dataset:
    Can find matching features
    The dataset was pulled
    Can get plot points
    """
    with app.test_client() as c:
        # Add custom dataset
        load_sample_cell_lines()
        csv_file = open(custom_csv_upload_file_path, "rb")
        args = {
            "uploadFile": (csv_file, "test.csv"),
            "displayName": "some dropdown label",
            "units": "some axis label",
            "transposed": "false",
        }
        r = c.post(
            url_for("interactive.add_custom_csv_dataset"),
            data=args,
            headers={"content-type": "multipart/form-data"},
        )
        assert r.status_code == 200
        response = json.loads(r.data.decode("utf8"))
        assert "datasetId" in response["result"]
        dataset_id = response["result"]["datasetId"]

        # Test that can get feature
        params = {
            "catalog": "continuous",
            "id": "custom_dataset/" + dataset_id,
            "prefix": custom_csv_feature,
        }
        r = c.get(url_for("vector_catalog.catalog_children", **params))

        assert r.status_code == 200
        response = json.loads(r.data.decode("utf8"))
        assert {
            "id": SliceSerializer.encode_slice_id(
                dataset_id, custom_csv_feature, SliceRowType.label
            ),
            "childValue": custom_csv_feature,
            "label": custom_csv_feature,
            "terminal": True,
            "url": None,
            "group": None,
        } in response["children"]

        # Test that can get plot points
        params = MultiDict(
            [
                (
                    "features",
                    InteractiveTree.get_id_from_dataset_feature(
                        dataset_id, custom_csv_feature
                    ),
                )
            ]
        )

        r = c.get(url_for("interactive.get_features", **params))
        assert r.status_code == 200
        response = json.loads(r.data.decode("utf8"))
        assert len(response["depmap_ids"]) == 2
        assert len(response["depmap_ids"]) == custom_csv_plot_points_length


def test_add_custom_csv_one_row(
    app, empty_db_mock_downloads, mock_celery_task_update_state
):
    with app.test_client() as c:
        # Add custom dataset
        load_sample_cell_lines()
        csv_file = open(custom_csv_one_row_upload_file_path, "rb")
        args = {
            "uploadFile": (csv_file, "test.csv"),
            "displayName": "some dropdown label",
            "units": "some axis label",
            "transposed": "false",
        }
        r = c.post(
            url_for("interactive.add_custom_csv_one_row_dataset"),
            data=args,
            headers={"content-type": "multipart/form-data"},
        )
        assert r.status_code == 200
        response = json.loads(r.data.decode("utf8"))

        assert response["state"] == "SUCCESS"
        assert "5 out of 8 cell lines matched" in response["result"]["warnings"][0]
