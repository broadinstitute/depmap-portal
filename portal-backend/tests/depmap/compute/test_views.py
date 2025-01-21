import json
import pytest
import pandas as pd
import numpy as np
from math import isclose
from flask import url_for
from unittest.mock import MagicMock

from breadbox_client.models import FeatureResponse, FeatureResponseValues

from depmap.compute import analysis_tasks
from depmap.vector_catalog.models import SliceRowType, SliceSerializer
from depmap.compute.views import subset_values_by_intersecting_cell_lines
from depmap.compute.analysis_tasks import run_custom_analysis  # imported to monkeypatch
from depmap.dataset.models import BiomarkerDataset
from tests.factories import (
    GeneFactory,
    BiomarkerDatasetFactory,
    MatrixFactory,
    CellLineFactory,
)
from tests.utilities import interactive_test_utils


@pytest.mark.parametrize(
    "analysisType, useQueryCellLines, addFakeCellLine, useQueryValues, useQueryId, vectorIsDependent",
    [
        (
            "association",
            False,
            False,
            False,
            True,
            True,
        ),  # Associations - specify queryId but no cell lines
        (
            "association",
            True,
            False,
            False,
            True,
            True,
        ),  # Associations - specify queryId but no cell lines
        ("pearson", False, False, False, True, None),  # pearson
        (
            "association",
            False,
            False,
            False,
            True,
            False,
        ),  # Associations - vector is independent
        ("two_class", True, True, True, False, True),  # Two-class comparison
        (
            "two_class",
            True,
            True,
            True,
            False,
            False,
        ),  # Two-class comparison - vector is independent
    ],
)

# @pytest.mark.skip(reason="rpy2.interface has no attribute 'INTSXP")
def test_compute_univariate_associations(
    app,
    empty_db_mock_downloads,
    celery_app,
    monkeypatch,
    analysisType,
    useQueryCellLines,
    addFakeCellLine,
    useQueryValues,
    useQueryId,
    vectorIsDependent,
):
    # celery_app is a test celery fixture that comes from celery, see https://docs.celeryproject.org/en/stable/userguide/testing.html#celery-app-celery-app-used-for-testing)
    # replace the task function with one bound to the celery_app, bypassing redis, bypassing redis
    monkeypatch.setattr(
        analysis_tasks,
        "run_custom_analysis",
        celery_app.task(bind=True)(run_custom_analysis),
    )

    gene_1 = GeneFactory(label="gene_1")
    gene_2 = GeneFactory(label="gene_2")
    cell_lines = [CellLineFactory(cell_line_name="CL" + str(i)) for i in range(8)]

    # specify this data to generate randomness, to allow the second gene slice to be used as the confounder without error
    df = pd.DataFrame(
        {
            "col0": [3, 7],
            "col1": [9, 5],
            "col2": [1, 4],
            "col3": [9, 1],
            "col4": [0, 2],
            "col5": [9, 1],
            "col6": [5, 4],
            "col7": [0, 2],
        }
    )

    gene_dataset = BiomarkerDatasetFactory(
        display_name="genedata",
        matrix=MatrixFactory(
            entities=[gene_1, gene_2], cell_lines=cell_lines, data=df.values
        ),
    )
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    with app.test_client() as c:
        # assemble query parameters
        dataset_id = gene_dataset.name.name
        slice_id = SliceSerializer.encode_slice_id(
            gene_dataset.name.name, gene_1.entity_id, SliceRowType.entity_id
        )
        subset_cell_lines = list([cell_lines[i].depmap_id for i in range(7)])

        num_in = int(len(subset_cell_lines) / 2)
        num_out = len(subset_cell_lines) - num_in + 1

        # parameters differ based on the parameters for this test
        if useQueryCellLines:
            query_cell_lines = subset_cell_lines
            if addFakeCellLine:
                query_cell_lines = query_cell_lines + ["fakecellline"]
        else:
            query_cell_lines = None

        parameters = {
            "analysisType": analysisType,
            "queryCellLines": query_cell_lines,
            "queryValues": ["in"] * num_in + ["out"] * num_out
            if useQueryValues
            else None,
            "vectorVariableType": None
            if vectorIsDependent is None
            else "dependent"
            if vectorIsDependent
            else "independent",
            "datasetId": dataset_id,
            "queryId": slice_id if useQueryId else None,
        }

        # hit endpoint
        r = c.post(
            url_for("compute.compute_univariate_associations"),
            data=json.dumps(parameters),
            content_type="application/json",
        )
        print("Checking params: {}".format(parameters))

        assert r.status_code == 200, r.status_code
        result = json.loads(r.data.decode("utf8"))
        assert result["state"] == "SUCCESS"
        assert len(result["result"]["data"]) > 0
        if parameters["queryCellLines"]:
            for row in result["result"]["data"]:
                assert row["numCellLines"] <= len(parameters["queryCellLines"])


# @pytest.mark.skip(reason="rpy2.interface has no attribute 'INTSXP")
def test_compute_univariate_associations_intersection_with_minimum_points(
    app, empty_db_mock_downloads, celery_app, monkeypatch
):
    """
    Tests the following issues
        Intersection of vector, cell line subset, and dataset all reduces the set of common cell lines
            including handling for vectors where the dataset has holes and different cell lines are NaN
        Number of cell lines used varies and is correct
        Able to return results for five points, which is the minimum

    Test setup involves
        dataset 1), contains the vector
            cell line common + vector cell line
            one entity
            has NaN for the extra vector cell line
        dataset 2), the dataset
            cell line common + dataset cell line
            three entities
            one of the entities does not have enough cell lines
            another has one fewer cell line with data
        subset cell lines
            common cell lines, + extra query cell line
    """
    # celery_app is a test celery fixture that comes from celery, see https://docs.celeryproject.org/en/stable/userguide/testing.html#celery-app-celery-app-used-for-testing)
    # replace the task function with one bound to the celery_app, bypassing redis
    monkeypatch.setattr(
        analysis_tasks,
        "run_custom_analysis",
        celery_app.task(bind=True)(run_custom_analysis),
    )

    # set up db items
    common_cell_lines = CellLineFactory.create_batch(6)

    vector_extra_cell_line = CellLineFactory()
    vector_entity = GeneFactory()

    vector_dataset = BiomarkerDatasetFactory(
        name=BiomarkerDataset.BiomarkerEnum.copy_number_relative,
        matrix=MatrixFactory(
            entities=[vector_entity],
            cell_lines=common_cell_lines + [vector_extra_cell_line],
            data=np.array([[5, 1.1, 3, 10, 1, 0, 1.3]]),  # first entity, vectory
        ),
    )

    dataset_extra_cell_line = CellLineFactory()
    dataset_entity_6_lines = GeneFactory()  # calculation involves 4 cell lines
    dataset_entity_7_lines = GeneFactory()
    dataset_skipped_entity_3_line = (
        GeneFactory()
    )  # calculation only has three lines, and should return no results

    query_dataset = BiomarkerDatasetFactory(
        name=BiomarkerDataset.BiomarkerEnum.expression,
        matrix=MatrixFactory(
            entities=[
                dataset_entity_6_lines,
                dataset_entity_7_lines,
                dataset_skipped_entity_3_line,
            ],
            cell_lines=common_cell_lines + [dataset_extra_cell_line],
            data=np.array(
                [
                    [8, np.NaN, 3.3, 0.2, 5, 0, 2],
                    [-2.9, 15, 3, 0.2, 5, 0, 3],
                    [np.NaN, np.NaN, 1.9, 3, 5, 0, 9],
                ]
            ),
        ),
    )

    dataset_id = query_dataset.name.name

    subset_extra_cell_line = CellLineFactory()
    subset_cell_lines = [
        cell_line.depmap_id
        for cell_line in common_cell_lines + [subset_extra_cell_line]
    ]

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    # slice IDs must be figured out after flushing the database. otherwise, the entities don't yet have entity ids
    vector_slice_id = SliceSerializer.encode_slice_id(
        vector_dataset.name.name, vector_entity.entity_id, SliceRowType.entity_id
    )
    with app.test_client() as c:
        r = c.post(
            url_for("compute.compute_univariate_associations"),
            data=json.dumps(
                {
                    "analysisType": "association",
                    "queryCellLines": subset_cell_lines,
                    "queryValues": None,
                    "datasetId": dataset_id,
                    "queryId": vector_slice_id,
                    "vectorVariableType": "dependent",
                    "confounderId": None,
                }
            ),
            content_type="application/json",
        )

        assert r.status_code == 200, r.status_code
        result = json.loads(r.data.decode("utf8"))
        assert result["state"] == "SUCCESS"
        table = result["result"]["data"]
        expected_table = [
            {
                "EffectSize": -0.2515742782636402,
                "PValue": 0.39796749567764594,
                "QValue": 0.8620908186786146,
                "label": dataset_entity_7_lines.label,
                "vectorId": "don't bother testing",
                "numCellLines": 6,
            }
        ]
        for row, expected_row in zip(table, expected_table):
            assert row["label"] == expected_row["label"]
            assert row["numCellLines"] == expected_row["numCellLines"]
            for col in [
                "EffectSize",
                "PValue",
                "QValue",
            ]:
                if expected_row[col] is None:
                    assert row[col] is None
                else:
                    assert isclose(row[col], expected_row[col])


def test_subset_values_by_intersecting_cell_lines():
    series_1 = pd.Series(
        [3, 5, 4],  # 5 before 4, different order
        index=[
            "ACH-000003",
            "ACH-000005",
            "ACH-000004",
        ],  # 5 before 4, different order
    )  # missing 1

    index_subset = [
        "ACH-000001",
        "ACH-000004",
        "ACH-000005",
        "ACH-not-in-series",
    ]  # missing 3

    # test with both provided
    (indices, values) = subset_values_by_intersecting_cell_lines(series_1, index_subset)

    assert len(indices) == len(values)

    if indices == ["ACH-000004", "ACH-000005"]:
        index_4 = 0
        index_5 = 1
    else:
        assert indices == ["ACH-000005", "ACH-000004"]
        index_4 = 1
        index_5 = 0

    assert values[index_4] == 4
    assert values[index_5] == 5

    # test without the index subset
    (indices, values) = subset_values_by_intersecting_cell_lines(series_1, None)
    assert set(indices) == {"ACH-000003", "ACH-000004", "ACH-000005"}
    index_to_val = {"ACH-000003": 3, "ACH-000004": 4, "ACH-000005": 5}
    for index, val in index_to_val.items():
        assert values[indices.index(index)] == val


def test_compute_univariate_associations_with_breadbox_feature(
    app, empty_db_mock_downloads, celery_app, monkeypatch, mock_breadbox_client
):
    """
    Test that custom analysis is able to handle a breadbox feature paired withe a legacy dataset.
    """
    # celery_app is a test celery fixture that comes from celery, see https://docs.celeryproject.org/en/stable/userguide/testing.html#celery-app-celery-app-used-for-testing)
    # replace the task function with one bound to the celery_app, bypassing redis, bypassing redis
    monkeypatch.setattr(
        analysis_tasks,
        "run_custom_analysis",
        celery_app.task(bind=True)(run_custom_analysis),
    )

    gene_1 = GeneFactory(label="gene_1")
    gene_2 = GeneFactory(label="gene_2")
    cell_lines = [CellLineFactory(cell_line_name="CL" + str(i)) for i in range(8)]

    # specify this data to generate randomness, to allow the second gene slice to be used as the confounder without error
    df = pd.DataFrame(
        {
            "col0": [3, 7],
            "col1": [9, 5],
            "col2": [1, 4],
            "col3": [9, 1],
            "col4": [0, 2],
            "col5": [9, 1],
            "col6": [5, 4],
            "col7": [0, 2],
        }
    )

    gene_dataset = BiomarkerDatasetFactory(
        display_name="genedata",
        matrix=MatrixFactory(
            entities=[gene_1, gene_2], cell_lines=cell_lines, data=df.values
        ),
    )
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    mock_breadbox_client.get_dataset_data = MagicMock(
        return_value=pd.DataFrame(
            data={"foo": [0.1, 0.2, 0.3]},
            index=[
                cell_lines[0].depmap_id,
                cell_lines[1].depmap_id,
                cell_lines[2].depmap_id,
            ],
        )
    )

    with app.test_client() as c:
        # assemble query parameters
        dataset_id = gene_dataset.name.name
        breadbox_slice_id = "slice/breadbox%2Ffoo/feature_foo/label"

        parameters = {
            "analysisType": "pearson",
            "queryCellLines": None,
            "queryValues": None,
            "datasetId": dataset_id,
            "queryId": breadbox_slice_id,
        }

        # hit endpoint
        r = c.post(
            url_for("compute.compute_univariate_associations"),
            data=json.dumps(parameters),
            content_type="application/json",
        )

        assert r.status_code == 200, r.status_code
        result = json.loads(r.data.decode("utf8"))
        assert result["state"] == "SUCCESS"

        result_data = result["result"]["data"]
        assert result_data is not None
        assert len(result_data) == 2
        assert result_data[0]["numCellLines"] == 3
        assert result_data[1]["numCellLines"] == 3
