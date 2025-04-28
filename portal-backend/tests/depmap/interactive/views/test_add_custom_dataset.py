import json

import tempfile
from multidict import MultiDict
import pandas as pd
from json import loads as json_loads
from werkzeug.datastructures import FileStorage
import pytest
from flask import url_for
import os
from loader.cell_line_loader import load_cell_lines_metadata

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
        loader_data_dir = empty_db_mock_downloads.app.config["LOADER_DATA_DIR"]
        load_cell_lines_metadata(
            os.path.join(loader_data_dir, "cell_line/cell_line_metadata.csv")
        )
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
    loader_data_dir = empty_db_mock_downloads.app.config["LOADER_DATA_DIR"]
    with app.test_client() as c:
        # Add custom dataset
        load_cell_lines_metadata(
            os.path.join(loader_data_dir, "cell_line/cell_line_metadata.csv")
        )
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
