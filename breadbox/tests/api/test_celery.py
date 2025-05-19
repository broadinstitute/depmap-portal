# from contextlib import contextmanager
# import json
# from typing import List
# import pytest
# import pandas as pd
# import numpy as np
# from math import isclose
# from fastapi.testclient import TestClient
# from sqlalchemy.orm import Session

# from breadbox.db.session import SessionWithUser
# from breadbox.models.dataset import ValueType
# from breadbox.compute import analysis_tasks
# from breadbox.compute.analysis_tasks import _subset_feature_df
# from breadbox.celery_task import utils
# from tests import factories
# from breadbox.compute.analysis_tasks import (
#     run_custom_analysis,
# )  # imported to monkeypatch


# def _create_cell_line_batch(num_cell_lines: int) -> List[str]:
#     cell_lines = [f"ACH-{i}" for i in range(num_cell_lines)]
#     return cell_lines


# @pytest.mark.celery
# @pytest.mark.parametrize(
#     "analysisType, useQueryCellLines, addFakeCellLine, useQueryValues, useQueryId, vectorIsDependent",
#     [
#         (
#             "association",
#             False,
#             False,
#             False,
#             True,
#             True,
#         ),  # Associations - specify queryId but no cell lines
#         (
#             "association",
#             True,
#             False,
#             False,
#             True,
#             True,
#         ),  # Associations - specify queryId but no cell lines
#         ("pearson", False, False, False, True, None),  # pearson
#         (
#             "association",
#             False,
#             False,
#             False,
#             True,
#             False,
#         ),  # Associations - vector is independent
#         ("two_class", True, True, True, False, True),  # Two-class comparison
#         (
#             "two_class",
#             True,
#             True,
#             True,
#             False,
#             False,
#         ),  # Two-class comparison - vector is independent
#     ],
# )
# # @pytest.mark.skip(reason="rpy2.interface has no attribute 'INTSXP")
# def test_compute_univariate_associations(
#     tmpdir,
#     minimal_db: SessionWithUser,
#     client: TestClient,
#     settings,
#     monkeypatch,
#     celery_app,
#     celery_worker,
#     analysisType,
#     useQueryCellLines,
#     addFakeCellLine,
#     useQueryValues,
#     useQueryId,
#     vectorIsDependent,
# ):
#     # celery_app is a test celery fixture that comes from celery, see https://docs.celeryproject.org/en/stable/userguide/testing.html#celery-app-celery-app-used-for-testing)
#     # replace the task function with one bound to the celery_app, bypassing redis, bypassing redis
#     @contextmanager
#     def mock_db_context(user, commit=True):
#         yield minimal_db

#     def get_test_settings():
#         return settings

#     def mock_check_celery():
#         return True

#     # Monkeypatch check_celery and pretend celery is running for test
#     monkeypatch.setattr(utils, "check_celery", mock_check_celery)

#     monkeypatch.setattr(
#         analysis_tasks, "get_settings", get_test_settings,
#     )
#     monkeypatch.setattr(analysis_tasks, "db_context", mock_db_context)
#     monkeypatch.setattr(
#         analysis_tasks,
#         "run_custom_analysis",
#         celery_app.task(bind=True)(run_custom_analysis),
#     )

#     feature_1 = "feature_1"
#     feature_2 = "feature_2"
#     cell_lines = _create_cell_line_batch(8)

#     # specify this data to generate randomness, to allow the second feature slice to be used as the confounder without error
#     df = pd.DataFrame(
#         {
#             "col0": [3, 7],
#             "col1": [9, 5],
#             "col2": [1, 4],
#             "col3": [9, 1],
#             "col4": [0, 2],
#             "col5": [9, 1],
#             "col6": [5, 4],
#             "col7": [0, 2],
#         }
#     )
#     user = settings.admin_users[0]
#     headers = {"X-Forwarded-User": user}
#     factories.feature_type(minimal_db, user, "gene")

#     gene_dataset = factories.matrix_dataset(
#         minimal_db,
#         settings,
#         data_file=factories.matrix_csv_data_file_with_values(
#             feature_ids=[feature_1, feature_2],
#             sample_ids=cell_lines,
#             values=df.transpose().values,
#         ),
#         feature_type="gene",
#         value_type=ValueType.continuous,
#         user=user,
#     )

#     # assemble query parameters
#     dataset_id = gene_dataset.id

#     query_dataset_id = dataset_id
#     query_feature_id = feature_1

#     subset_cell_lines = _create_cell_line_batch(7)

#     num_in = int(len(subset_cell_lines) / 2)
#     num_out = len(subset_cell_lines) - num_in + 1

#     # parameters differ based on the parameters for this test
#     if useQueryCellLines:
#         query_cell_lines = subset_cell_lines
#         if addFakeCellLine:
#             query_cell_lines = query_cell_lines + ["fakecellline"]
#     else:
#         query_cell_lines = None

#     if analysisType == "two_class":
#         assert useQueryValues == True

#     data = {
#         "user": user,
#         "queryCellLines": query_cell_lines,
#         "queryValues": ["in"] * num_in + ["out"] * num_out if useQueryValues else None,
#         "analysisType": analysisType,
#         "datasetId": dataset_id,
#         "queryId": None,
#         "queryFeatureId": query_feature_id if useQueryId else None,
#         "queryDatasetId": query_dataset_id if useQueryId else None,
#         "vectorVariableType": (
#             None
#             if vectorIsDependent is None
#             else "dependent"
#             if vectorIsDependent
#             else "independent"
#         ),
#     }

#     # hit endpoint
#     r = client.post(
#         "/compute/compute_univariate_associations", json=data, headers=headers,
#     )

#     assert r.status_code == 200, r.status_code
#     result = r.json()
#     assert result["state"] == "SUCCESS"
#     assert len(result["result"]["data"]) > 0
#     if data["queryCellLines"]:
#         for row in result["result"]["data"]:
#             assert row["numCellLines"] <= len(data["queryCellLines"])


# @pytest.mark.celery
# def test_compute_univariate_associations_intersection_with_minimum_points(
#     tmpdir,
#     minimal_db: SessionWithUser,
#     client: TestClient,
#     settings,
#     celery_app,
#     celery_worker,
#     monkeypatch,
# ):
#     """
#     Tests the following issues
#         Intersection of vector, cell line subset, and dataset all reduces the set of common cell lines
#             including handling for vectors where the dataset has holes and different cell lines are NaN
#         Number of cell lines used varies and is correct
#         Able to return results for five points, which is the minimum

#     Test setup involves
#         dataset 1), contains the vector
#             cell line common + vector cell line
#             one entity
#             has NaN for the extra vector cell line
#         dataset 2), the dataset
#             cell line common + dataset cell line
#             three entities
#             one of the entities does not have enough cell lines
#             another has one fewer cell line with data
#         subset cell lines
#             common cell lines, + extra query cell line
#     """

#     # celery_app is a test celery fixture that comes from celery, see https://docs.celeryproject.org/en/stable/userguide/testing.html#celery-app-celery-app-used-for-testing)
#     # replace the task function with one bound to the celery_app, bypassing redis
#     @contextmanager
#     def mock_db_context(user, commit=True):
#         yield minimal_db

#     def get_test_settings():
#         return settings

#     def mock_check_celery():
#         return True

#     # Monkeypatch check_celery and pretend celery is running for test
#     monkeypatch.setattr(utils, "check_celery", mock_check_celery)

#     monkeypatch.setattr(
#         analysis_tasks, "get_settings", get_test_settings,
#     )

#     monkeypatch.setattr(
#         analysis_tasks, "db_context", mock_db_context,
#     )

#     monkeypatch.setattr(
#         analysis_tasks,
#         "run_custom_analysis",
#         celery_app.task(bind=True)(run_custom_analysis),
#     )

#     user = settings.admin_users[0]
#     headers = {"X-Forwarded-User": user}

#     # set up db items
#     common_cell_lines = _create_cell_line_batch(6)

#     vector_extra_cell_line = f"ACH-7"
#     vector_feature = "feature_0"

#     factories.feature_type(minimal_db, user, "gene")
#     vector_dataset = factories.matrix_dataset(
#         minimal_db,
#         settings,
#         data_file=factories.matrix_csv_data_file_with_values(
#             feature_ids=[vector_feature],
#             sample_ids=common_cell_lines + [vector_extra_cell_line],
#             values=np.array([[5, 1.1, 3, 10, 1, 0, 1.3]]).transpose(),
#         ),
#         feature_type="gene",
#         value_type=ValueType.continuous,
#         user=user,
#     )

#     dataset_extra_cell_line = "ACH-57"
#     dataset_entity_6_lines = "gene_15"  # calculation involves 4 cell lines
#     dataset_entity_7_lines = "gene_16"
#     dataset_skipped_entity_3_line = "gene_17"

#     query_dataset = factories.matrix_dataset(
#         minimal_db,
#         settings,
#         data_file=factories.matrix_csv_data_file_with_values(
#             feature_ids=[
#                 dataset_entity_6_lines,
#                 dataset_entity_7_lines,
#                 dataset_skipped_entity_3_line,
#             ],
#             sample_ids=common_cell_lines + [dataset_extra_cell_line],
#             values=np.array(
#                 [
#                     [8, np.NaN, 3.3, 0.2, 5, 0, 2],
#                     [-2.9, 15, 3, 0.2, 5, 0, 3],
#                     [np.NaN, np.NaN, 1.9, 3, 5, 0, 9],
#                 ]
#             ).transpose(),
#         ),
#         feature_type="gene",
#         value_type=ValueType.continuous,
#         user=user,
#     )

#     dataset_id = query_dataset.id

#     subset_extra_cell_line = "ACH-58"
#     subset_cell_lines = [
#         cell_line for cell_line in common_cell_lines + [subset_extra_cell_line]
#     ]

#     query_dataset_id = vector_dataset.id
#     query_feature_id = vector_feature

#     data = {
#         "user": user,
#         "queryCellLines": subset_cell_lines,
#         "queryValues": None,
#         "analysisType": "association",
#         "datasetId": dataset_id,
#         "queryId": None,
#         "queryFeatureId": query_feature_id,
#         "queryDatasetId": query_dataset_id,
#         "vectorVariableType": "dependent",
#         "queryValues": None,
#     }

#     # hit endpoint
#     r = client.post(
#         "/compute/compute_univariate_associations", json=data, headers=headers,
#     )

#     assert r.status_code == 200, r.status_code
#     result = r.json()
#     assert result["state"] == "SUCCESS"

#     table = result["result"]["data"]

#     expected_table = [
#         {
#             "EffectSize": -0.2515742782636402,
#             "PValue": 0.39796749567764594,
#             "QValue": 0.8620908186786146,
#             "label": dataset_entity_7_lines,
#             "vectorId": "don't bother testing",
#             "numCellLines": 6,
#         }
#     ]

#     for row, expected_row in zip(table, expected_table):
#         assert row["label"] == expected_row["label"]
#         assert row["numCellLines"] == expected_row["numCellLines"]
#         for col in [
#             "EffectSize",
#             "PValue",
#             "QValue",
#         ]:
#             if expected_row[col] is None:
#                 assert row[col] is None
#             else:
#                 assert isclose(row[col], expected_row[col])


# def test_subset_values_by_intersecting_cell_lines():
#     series_1 = pd.Series(
#         [3, 5, 4],  # 5 before 4, different order
#         index=[
#             "ACH-000003",
#             "ACH-000005",
#             "ACH-000004",
#         ],  # 5 before 4, different order
#     )  # missing 1

#     index_subset = [
#         "ACH-000001",
#         "ACH-000004",
#         "ACH-000005",
#         "ACH-not-in-series",
#     ]  # missing 3

#     # test with both provided
#     (indices, values) = _subset_feature_df(series_1, index_subset)

#     assert len(indices) == len(values)

#     if indices == ["ACH-000004", "ACH-000005"]:
#         index_4 = 0
#         index_5 = 1
#     else:
#         assert indices == ["ACH-000005", "ACH-000004"]
#         index_4 = 1
#         index_5 = 0

#     assert values[index_4] == 4
#     assert values[index_5] == 5

#     # test without the index subset
#     (indices, values) = _subset_feature_df(series_1, None)
#     assert set(indices) == {"ACH-000003", "ACH-000004", "ACH-000005"}
#     index_to_val = {"ACH-000003": 3, "ACH-000004": 4, "ACH-000005": 5}
#     for index, val in index_to_val.items():
#         assert values[indices.index(index)] == val
