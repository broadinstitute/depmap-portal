import json
import pandas as pd

from depmap import data_access
from depmap.compute import analysis_tasks
from depmap.settings.settings import TestConfig
from depmap.interactive.nonstandard.models import RowNonstandardMatrix
from depmap_compute.analysis_tasks_interface import _run_custom_analysis
from depmap_compute.models import AnalysisType
from math import isclose
from tests.utilities import interactive_test_utils
from tests.utilities.override_fixture import override
from tests.factories import NonstandardMatrixFactory, CellLineFactory

nonstandard_dataset_id = "test-id.1"


def config(request):
    """
    Override the default conftest config fixture
    """

    def get_nonstandard_datasets():
        return {
            nonstandard_dataset_id: {
                "transpose": False,
                "use_arxspan_id": True,
                "label": "test label",
                "units": "test units",
                "feature_name": "test name",
                "is_continuous": True,
                "data_type": "user_upload",
            }
        }

    class TestVersionConfig(TestConfig):
        GET_NONSTANDARD_DATASETS = get_nonstandard_datasets

    return TestVersionConfig


@override(config=config)
# @pytest.mark.skip(reason="rpy2.interface has no attribute 'INTSXP")
def test_run_custom_analysis_missing_row_matrix_index(
    tmpdir, app, empty_db_mock_downloads
):
    cell_line_1 = CellLineFactory()
    cell_line_2 = CellLineFactory()
    cell_line_3 = CellLineFactory()
    cell_line_4 = CellLineFactory()
    cell_line_5 = CellLineFactory()
    cell_line_6 = CellLineFactory()
    cell_lines = [
        cell_line_1,
        cell_line_2,
        cell_line_3,
        cell_line_4,
        cell_line_5,
        cell_line_6,
    ]
    rows = ["row 0", "row 1", "row 2", "row 3"]
    data = pd.DataFrame(
        {
            cell_line_1.depmap_id: [11, 1, 0.111, 5],
            cell_line_2.depmap_id: [12, 3, -0.211, 1],
            cell_line_3.depmap_id: [13, 4, 0.131, 3],
            cell_line_4.depmap_id: [3, 21, 0.131, 3],
            cell_line_5.depmap_id: [2, 20, 2.131, 7],
            cell_line_6.depmap_id: [1, 22, 24, 1],
        },
        index=rows
        # I believe this index doesn't do anything? has to do with order that entities=[] is passed in?
    )
    query_values = [1, 1, 1, 0, 0, 0]
    nonstandard_matrix = NonstandardMatrixFactory(
        nonstandard_dataset_id,
        entities=rows,
        cell_lines=cell_lines,
        data=data,
        rows_are_entities=False,
    )
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    assert len(RowNonstandardMatrix.query.all()) == 4

    cl_query_vector = [x.depmap_id for x in cell_lines]
    feature_labels = data_access.get_dataset_feature_labels(nonstandard_dataset_id)
    features = analysis_tasks.get_features(nonstandard_dataset_id, feature_labels)
    feature_type = data_access.get_dataset_feature_type(nonstandard_dataset_id)
    assert feature_type is not None
    dataset_df = data_access.get_subsetted_df_by_labels(
        nonstandard_dataset_id, feature_labels, cl_query_vector
    )

    result = _run_custom_analysis(
        task_id="test_no_hole",
        update_message=(lambda *x, **y: None),
        analysis_type=AnalysisType.association,
        depmap_model_ids=cl_query_vector,
        value_query_vector=query_values,
        features=features,
        feature_type=feature_type,
        dataset=dataset_df.values,
        vector_is_dependent=False,
        parameters={
            "query": {
                "queryValues": query_values,
                "queryCellLines": cl_query_vector,
                "vectorVariableType": "independent",
            },
            "datasetId": nonstandard_dataset_id,
        },
        result_dir=str(tmpdir),
        create_cell_line_group=analysis_tasks.create_cell_line_group,
    )

    with open(result["data_json_file_path"], "rt") as fd:
        df = pd.DataFrame(json.load(fd))
    assert len(df) == 4
    expected_row_0_effect_size = (11 + 12 + 13) / 3 - (3 + 2 + 1) / 3
    expected_row_1_effect_size = (1 + 3 + 4) / 3 - (21 + 20 + 22) / 3
    assert isclose(
        df.EffectSize[df.label == "row 0"], expected_row_0_effect_size, abs_tol=1e-3
    )
    assert isclose(
        df.EffectSize[df.label == "row 1"], expected_row_1_effect_size, abs_tol=1e-3
    )

    RowNonstandardMatrix.query.filter_by(
        nonstandard_matrix_id=nonstandard_matrix.nonstandard_matrix_id, index=0
    ).delete()
    empty_db_mock_downloads.session.flush()

    assert len(RowNonstandardMatrix.query.all()) == 3
    assert set(row.index for row in RowNonstandardMatrix.query.all()) == {1, 2, 3}

    cl_query_vector = [x.depmap_id for x in cell_lines]
    feature_labels = data_access.get_dataset_feature_labels(nonstandard_dataset_id)
    features = analysis_tasks.get_features(nonstandard_dataset_id, feature_labels)
    feature_type = data_access.get_dataset_feature_type(nonstandard_dataset_id)
    assert feature_type is not None
    dataset_df = data_access.get_subsetted_df_by_labels(
        nonstandard_dataset_id, feature_labels, cl_query_vector
    )

    result_with_hole = _run_custom_analysis(
        task_id="test_with_hole",
        update_message=(lambda *x, **y: None),
        analysis_type=AnalysisType.association,
        depmap_model_ids=cl_query_vector,
        value_query_vector=query_values,
        features=features,
        feature_type=feature_type,
        dataset=dataset_df.values,
        vector_is_dependent=False,
        parameters={
            "query": {
                "queryValues": query_values,
                "queryCellLines": cl_query_vector,
                "vectorVariableType": "independent",
            },
            "datasetId": nonstandard_dataset_id,
        },
        result_dir=str(tmpdir),
        create_cell_line_group=analysis_tasks.create_cell_line_group,
    )

    with open(result_with_hole["data_json_file_path"], "rt") as fd:
        hole_df = pd.DataFrame(json.load(fd))

    assert len(hole_df) == 3

    assert set(df.label.values) == set(rows)
    assert set(hole_df.label.values) == {"row 1", "row 2", "row 3"}

    assert isclose(
        hole_df.EffectSize[df.label == "row 1"],
        expected_row_1_effect_size,
        abs_tol=1e-3,
    )
