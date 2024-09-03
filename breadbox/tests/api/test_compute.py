from contextlib import contextmanager
import json
from fastapi.testclient import TestClient
from math import isclose
from scipy import stats
import numpy
import numpy as np
import pandas as pd
import pytest
import re
from sqlalchemy import and_

from breadbox.db.session import SessionWithUser
from breadbox.compute.analysis_tasks import run_custom_analysis
from breadbox.api import compute
from depmap_compute.models import AnalysisType
from breadbox.models.dataset import DatasetFeature
from breadbox.models.dataset import ValueType
from depmap_compute.analysis_tasks_interface import (
    fast_cor_with_p_and_q_values_with_missing,
)
from breadbox.compute import analysis_tasks
from breadbox.compute.analysis_tasks import get_feature_data_slice_values
from breadbox.crud.dataset import get_dataset
from tests import factories


class TestData:

    association_query_vector = list(range(10))

    expected_pearsonCor = [0.828417, 0.332349, 0.195789]
    expected_pearsonPValue = [0.005800, 0.382209, 0.587756]
    expected_pearsonQValue = [0.005800, 0.382209, 0.587756]

    # for dev sanity checking
    __pearson_results = """
    python
                Cor    PValue    QValue   label                 vectorId  numCellLines
        0  0.828417  0.005800  0.005800  gene_0  slice/Avana/1/entity_id             9
        1  0.332349  0.382209  0.382209  gene_1  slice/Avana/2/entity_id             9
        2  0.195789  0.587756  0.587756  gene_2  slice/Avana/3/entity_id            10
    """

    # for dev sanity checking
    __r_lin_association_results = """
    lin_association results
    A_is_independent true aka vector_is_dependent true
        lin_associations_with_ind_flag(mat, query, A_is_independent=T)
    $res.table
         betahat sebetahat NegativeProb PositiveProb       lfsr     svalue       lfdr     qvalue PosteriorMean PosteriorSD ind.var       p.val
    1 0.54732465 0.1398692            0   0.98955133 0.01044867 0.01044867 0.01044867 0.01044867   0.520370471  0.13218499      c1 0.005800119
    2 0.21562200 0.2312777            0   0.09148430 0.90851570 0.45948218 0.90851570 0.45948218   0.025711597  0.09606980      c2 0.382208632
    3 0.08908407 0.1577539            0   0.04375516 0.95624484 0.62506974 0.95624484 0.62506974   0.007186298  0.04095094      c3 0.587756065
    
    
    A_is_independent false aka vector_is_dependent false:
        lin_associations_with_ind_flag(mat, query, A_is_independent=F)
    $res.table
        betahat sebetahat NegativeProb PositiveProb        lfsr      svalue        lfdr      qvalue PosteriorMean PosteriorSD dep.var ind.var       p.val
    1 1.2538710 0.3204275            0   0.99003836 0.009961638 0.009961638 0.009961638 0.009961638    1.19270818   0.3017409      c1      c1 0.005800119
    2 0.5122656 0.5494597            0   0.09835614 0.901643860 0.455802749 0.901643860 0.455802749    0.06518734   0.2338175      c2      c1 0.382208632
    3 0.4303030 0.7619992            0   0.08652833 0.913471666 0.608359055 0.913471666 0.608359055    0.06129172   0.2377730      c3      c1 0.587756065
    """

    # for dev sanity checking
    __r_two_class_results = """    
    A_is_independent true:
        lin_associations_with_ind_flag(mat, two_class_query, A_is_independent=T)
    $res.table
          betahat  sebetahat NegativeProb PositiveProb      lfsr    svalue      lfdr    qvalue PosteriorMean PosteriorSD ind.var      p.val
    1  0.08730159 0.02829928            0   0.84035955 0.1596405 0.1596405 0.1596405 0.1596405  0.0669789293 0.035737556      c1 0.01769222
    2  0.04464286 0.03921027            0   0.10565846 0.8943415 0.5269910 0.8943415 0.5269910  0.0053842954 0.018208126      c2 0.29235199
    3 -0.01129235 0.02771734            0   0.01895479 0.9810452 0.6783424 0.9810452 0.6783424  0.0003502296 0.003237717      c3 0.69439023    
        
    A_is_independent false:
        lin_associations_with_ind_flag(mat, two_class_query, A_is_independent=F)
    $res.table
      betahat sebetahat NegativeProb PositiveProb      lfsr    svalue      lfdr    qvalue PosteriorMean PosteriorSD dep.var ind.var      p.val
    1     6.6  2.139426            0   0.84492638 0.1550736 0.1550736 0.1550736 0.1550736     5.0911246   2.6831094      c1      c1 0.01769222
    2     3.5  3.074085            0   0.11151420 0.8884858 0.5217797 0.8884858 0.5217797     0.4397579   1.4409517      c2      c1 0.29235199
    3    -1.8  4.418144            0   0.03954273 0.9604573 0.6680056 0.9604573 0.6680056     0.1094459   0.6788697      c3      c1 0.69439023
    """

    # for devs
    __r_snippet_for_verification = """
    # matches the python data used in this test
    
    # matches association_query_vector
    query <- c(0, 1, 2, 3, 4, 5, 6, 7, 8, 9)    
    two_class_query <- c(0, 0, 0, 0, 0, 1, 1, 1, 1, 1)    
    
    # matches _make_data()
    mat <- matrix(c(1, 2, -5, 4, 5, 6, 7, NaN, 9, 10, -5, 4, 5, 6, -Inf, 8, 9, 10, 1, 2, 1, 2, -5, 4, 5, -6, -7, -8, 9, 10), ncol=3))
    
    # the method requires matrix to have row/col names
    rownames(mat) <- paste0("x", seq(10))
    colnames(mat) <- paste0("c", seq(3))
    
    # insert code from r_function_definitions.py, which is currently a copy of commit 19fbe32 of https://github.com/broadinstitute/cdsr_models/blob/master/R/linear_association.R  
    
    lin_associations_with_ind_flag(mat, query, A_is_independent=T)
    lin_associations_with_ind_flag(mat, query, A_is_independent=F)
    lin_associations_with_ind_flag(mat, two_class_query, A_is_independent=T)
    lin_associations_with_ind_flag(mat, two_class_query, A_is_independent=F)
    """

    @staticmethod
    def _make_data(test_empty_assoc_table=False):
        if test_empty_assoc_table:
            return numpy.ones((4, 10))

        # just some dummy data which we can use to test output values from lmstat and pearson cor
        data = numpy.zeros((4, 10))
        data[0, :] = [1, 2, -5, 4, 5, 6, 7, np.nan, 9, 10]
        data[1, :] = [-5, 4, 5, 6, -np.inf, 8, 9, 10, 1, 2]
        data[2, :] = [1, 2, -5, 4, 5, -6, -7, -8, 9, 10]
        data[3, :] = [0, 1, 2, -3, 4, 5, 6, 7, 8, -9]
        return data.transpose()

    @staticmethod
    def setup_db_objects(
        tmpdir,
        minimal_db: SessionWithUser,
        settings,
        vector_models,
        vector_data,
        test_empty_assoc_table=False,
        data=numpy.zeros((0,)),
    ):
        n_features, n_model_ids = (3, 10)
        data = TestData._make_data(test_empty_assoc_table) if len(data) == 0 else data
        models = ["ACH-0000{}".format(x) for x in range(n_model_ids)]

        admin_user = settings.admin_users[0]
        gene_metadata = pd.DataFrame(
            {
                "entrez_id": ["A", "B", "C"],
                "label": ["Gene A Label", "Gene B Label", "Gene C Label"],
            }
        )
        factories.feature_type_with_metadata(
            db=minimal_db,
            settings=settings,
            user=admin_user,
            name="gene",
            id_column="entrez_id",
            metadata_df=gene_metadata,
        )

        vector_dataset = factories.matrix_dataset(
            minimal_db,
            settings,
            data_file=factories.matrix_csv_data_file_with_values(
                feature_ids=["B"], sample_ids=vector_models, values=vector_data,
            ),
            feature_type="gene",
            value_type=ValueType.continuous,
        )
        query_dataset = factories.matrix_dataset(
            minimal_db,
            settings,
            data_file=factories.matrix_csv_data_file_with_values(
                feature_ids=[
                    "A",
                    "B",
                    "C",
                    "D",
                ],  # Feature D does not have metadata and should be ignored
                sample_ids=models,
                values=data,
            ),
            feature_type="gene",
            value_type=ValueType.continuous,
        )

        dataset_id = query_dataset.id

        results_dir = str(tmpdir.join("results"))

        return dataset_id, vector_dataset.id, "B", results_dir


# Get the query series associated with the color or filter slice
def _get_query_series(minimal_db, settings, result, search_string):
    user = settings.default_user
    dataset_slice_id = result[search_string]
    dataset_id, feature_id = _get_dataset_id_from_bb_slice_id(dataset_slice_id)
    dataset = get_dataset(minimal_db, user, dataset_id)
    dataset_feature = (
        minimal_db.query(DatasetFeature)
        .filter(
            and_(
                DatasetFeature.dataset_id == dataset_id,
                DatasetFeature.given_id == feature_id,
            )
        )
        .one()
    )

    query_series = get_feature_data_slice_values(
        minimal_db,
        settings.default_user,
        dataset_feature.id,
        dataset,
        settings.filestore_location,
    )

    return query_series


def _get_dataset_id_from_bb_slice_id(slice_id):
    SLICE_ID_PATTERN = re.compile("breadbox/([^/]+)(?:/([^/]+))")
    m = SLICE_ID_PATTERN.match(slice_id)
    assert m, "Could not match id {}".format(slice_id)

    dataset_id = m.group(1)
    feature_id = m.group(2)
    return dataset_id, feature_id


def _run_custom_analysis_test_wrapper(
    tmpdir,
    analysis_type: AnalysisType,
    minimal_db: SessionWithUser,
    settings,
    model_ids,
    vector_models,
    vector_data,
    query_values=None,
    vector_is_dependent=None,
    test_empty_assoc_table=False,
    data=[],
    use_query_id=True,
):
    (
        dataset_id,
        query_dataset_id,
        query_feature_id,
        results_dir,
    ) = TestData.setup_db_objects(
        tmpdir,
        minimal_db,
        settings,
        vector_models,
        vector_data,
        test_empty_assoc_table,
        data,
    )

    query_feature_id = query_feature_id if use_query_id else None
    query_dataset_id = query_dataset_id if use_query_id else None

    compute._validate_parameters(
        analysis_type=analysis_type,
        query_node_id=None,
        query_feature_id=query_feature_id,
        query_dataset_id=query_dataset_id,
        query_values=query_values,
        depmap_model_ids=model_ids,
    )

    # columns to search determined by dataset_feature instead of dep_mat_col_indices
    minimal_db.reset_user(settings.default_user)
    result = run_custom_analysis(
        user=settings.default_user,
        analysis_type=analysis_type.name,
        query_node_id=None,
        query_feature_id=query_feature_id,
        query_dataset_id=query_dataset_id,
        filestore_location=settings.filestore_location,
        dataset_id=dataset_id,
        depmap_model_ids=model_ids,
        query_values=query_values,
        vector_is_dependent=vector_is_dependent,
        results_dir=results_dir,
    )

    with open(result["data_json_file_path"], "rt") as fd:
        df = pd.DataFrame(json.load(fd))

    return df, result


def assert_series_is_6dp_close(series, expected_values):
    assert len(series) == len(expected_values)
    for val, expected in zip(list(series), expected_values):
        assert isclose(
            val, expected, abs_tol=1e-06
        ), "{} not close to {}".format(  # match the first 6 decimals
            val, expected
        )


def test_run_custom_analysis_pearson(
    tmpdir, minimal_db: SessionWithUser, settings, monkeypatch
):
    """
    Test running linear association, including
        values are correct
        structure of the response
        cell line group is created and can be retrieved
    """
    # num_custom_cell_line_groups = len(CustomCellLineGroup.query.all())

    @contextmanager
    def mock_db_context(user, **kwargs):
        yield minimal_db

    def get_test_settings():
        return settings

    monkeypatch.setattr(
        analysis_tasks, "get_settings", get_test_settings,
    )

    monkeypatch.setattr(
        analysis_tasks, "db_context", mock_db_context,
    )

    cell_lines = ["ACH-0000{}".format(x) for x in range(10)]

    df, result = _run_custom_analysis_test_wrapper(
        tmpdir=tmpdir,
        analysis_type=AnalysisType.pearson,
        minimal_db=minimal_db,
        model_ids=cell_lines,
        vector_models=cell_lines,
        vector_data=list(range(10)),
        settings=settings,
    )

    assert len(df["label"]) == 3 and len(df["vectorId"]) == 3

    df.sort_values(["label"], inplace=True)
    assert_series_is_6dp_close(df["Cor"], TestData.expected_pearsonCor)
    assert_series_is_6dp_close(df["PValue"], TestData.expected_pearsonPValue)
    assert_series_is_6dp_close(df["QValue"], TestData.expected_pearsonQValue)
    assert list(df["numCellLines"]) == [9, 9, 10]

    assert result["numCellLinesUsed"] == len(cell_lines)

    query_series = _get_query_series(minimal_db, settings, result, "filterSliceId")
    assert query_series["custom_cell_lines"].index.tolist() == cell_lines

    # in group cell lines should not be defined for assoc. only one cell ling group should have been written
    assert result["colorSliceId"] == None

    # assert len(CustomCellLineGroup.query.all()) == num_custom_cell_line_groups + 1


def test_run_custom_analysis_pearson_with_feature_ids_and_query_values(
    tmpdir, minimal_db: SessionWithUser, settings, monkeypatch
):
    """
    The legacy portal makes custom analysis requests to breadbox with a slightly different format.
    1. It uses feature ids instead of node ids (with the flag use_feature_ids=True)
    2. It sometimes passes in pre-loaded query values instead of using the query_node_id parameter
    """

    @contextmanager
    def mock_db_context(user, **kwargs):
        yield minimal_db

    def get_test_settings():
        return settings

    monkeypatch.setattr(
        analysis_tasks, "get_settings", get_test_settings,
    )

    monkeypatch.setattr(
        analysis_tasks, "db_context", mock_db_context,
    )

    cell_lines = ["ACH-0000{}".format(x) for x in range(10)]
    vector_data = list(range(10))

    (
        dataset_id,
        query_dataset_id,
        query_feature_id,
        results_dir,
    ) = TestData.setup_db_objects(
        tmpdir,
        minimal_db,
        settings,
        vector_models=cell_lines,
        vector_data=vector_data,
        test_empty_assoc_table=False,
    )

    minimal_db.reset_user(settings.default_user)
    result = run_custom_analysis(
        user=settings.default_user,
        analysis_type=AnalysisType.pearson.name,
        query_node_id=None,
        query_feature_id=None,
        query_dataset_id=None,
        filestore_location=settings.filestore_location,
        dataset_id=dataset_id,
        depmap_model_ids=cell_lines,
        query_values=vector_data,
        vector_is_dependent=None,
        results_dir=results_dir,
    )

    with open(result["data_json_file_path"], "rt") as fd:
        result_df = pd.DataFrame(json.load(fd))

    assert result["numCellLinesUsed"] == 10

    # Check that all returned vectorIds are formatted like breadbox feature slice Ids
    breadbox_slice_id_pattern = "breadbox/([^/]+)(?:/([^/]+))"
    assert re.match(breadbox_slice_id_pattern, result["filterSliceId"])
    assert len(result_df["vectorId"]) > 0
    for vector_id in result_df["vectorId"].tolist():
        assert re.match(breadbox_slice_id_pattern, vector_id)

    # check that the calculated values are not null
    assert result_df["Cor"].isna().sum() == 0
    assert result_df["PValue"].isna().sum() == 0
    assert result_df["QValue"].isna().sum() == 0


def test_run_custom_analysis_two_class(
    tmpdir, monkeypatch, minimal_db: SessionWithUser, settings
):
    @contextmanager
    def mock_db_context(user, **kwargs):
        yield minimal_db

    def get_test_settings():
        return settings

    monkeypatch.setattr(
        analysis_tasks, "get_settings", get_test_settings,
    )

    monkeypatch.setattr(
        analysis_tasks, "db_context", mock_db_context,
    )

    in_cell_lines = ["ACH-0000{}".format(x) for x in range(6)]
    out_cell_lines = ["ACH-0000{}".format(x) for x in range(6, 10)]
    all_cell_lines = in_cell_lines + out_cell_lines

    df, result = _run_custom_analysis_test_wrapper(
        tmpdir=tmpdir,
        analysis_type=AnalysisType.two_class,
        minimal_db=minimal_db,
        settings=settings,
        model_ids=all_cell_lines,
        vector_models=all_cell_lines,
        vector_data=[1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
        query_values=["in", "in", "in", "in", "in", "in", "out", "out", "out", "out"],
        vector_is_dependent=True,
        use_query_id=False,
    )
    row = df[df["label"] == "A"]

    assert ((row["EffectSize"] - (6.6)) < 0.0001).all()

    assert result["numCellLinesUsed"] == len(all_cell_lines)

    query_series = _get_query_series(minimal_db, settings, result, "filterSliceId")

    assert query_series["custom_cell_lines"].index.tolist() == all_cell_lines

    query_series = _get_query_series(minimal_db, settings, result, "colorSliceId")

    assert query_series["custom_cell_lines"].index.tolist() == in_cell_lines


def test_run_custom_analysis_assoc_vector_is_dependent_true(
    tmpdir, minimal_db: SessionWithUser, settings, monkeypatch
):
    """
    Test running linear association, including
        values are correct
        structure of the response
        cell line group is created and can be retrieved
    """
    # num_custom_cell_line_groups = len(CustomCellLineGroup.query.all())

    @contextmanager
    def mock_db_context(user, **kwargs):
        yield minimal_db

    def get_test_settings():
        return settings

    monkeypatch.setattr(
        analysis_tasks, "get_settings", get_test_settings,
    )

    monkeypatch.setattr(
        analysis_tasks, "db_context", mock_db_context,
    )

    cell_lines = ["ACH-0000{}".format(x) for x in range(10)]
    df, result = _run_custom_analysis_test_wrapper(
        tmpdir=tmpdir,
        analysis_type=AnalysisType.association,
        vector_is_dependent=True,
        model_ids=cell_lines,
        minimal_db=minimal_db,
        settings=settings,
        vector_models=cell_lines,
        vector_data=list(range(10)),
    )

    assert len(df["label"]) == 3 and len(df["vectorId"]) == 3
    df.sort_values(["label"], inplace=True)
    assert_series_is_6dp_close(df["EffectSize"], [0.555556, 0.225498, 0.089084])
    assert_series_is_6dp_close(df["PValue"], [0.005800, 0.354454, 0.587756])
    assert_series_is_6dp_close(df["QValue"], [0.017400, 0.531682, 0.587756])
    assert list(df["numCellLines"]) == [9, 9, 10]

    assert result["numCellLinesUsed"] == len(cell_lines)

    query_series = _get_query_series(minimal_db, settings, result, "filterSliceId")
    assert query_series["custom_cell_lines"].index.tolist() == cell_lines

    # in group cell lines should not be defined for assoc. only one cell ling group should have been written
    assert result["colorSliceId"] == None
    # assert len(CustomCellLineGroup.query.all()) == num_custom_cell_line_groups + 1


def test_run_custom_analysis_assoc_with_vector_is_dependent_false(
    tmpdir, minimal_db: SessionWithUser, settings, monkeypatch
):
    """
    Test running with a confounder supplied
    """

    @contextmanager
    def mock_db_context(user, **kwargs):
        yield minimal_db

    def get_test_settings():
        return settings

    monkeypatch.setattr(
        analysis_tasks, "get_settings", get_test_settings,
    )

    monkeypatch.setattr(
        analysis_tasks, "db_context", mock_db_context,
    )

    cell_lines = ["ACH-0000{}".format(x) for x in range(10)]

    df, result = _run_custom_analysis_test_wrapper(
        tmpdir=tmpdir,
        analysis_type=AnalysisType.association,
        vector_is_dependent=False,
        model_ids=cell_lines,
        minimal_db=minimal_db,
        settings=settings,
        vector_models=cell_lines,
        vector_data=list(range(10)),
    )

    assert len(df["label"]) == 3 and len(df["vectorId"]) == 3
    df.sort_values(["label"], inplace=True)
    assert_series_is_6dp_close(
        df["EffectSize"], [1.257015, 0.535728, 0.430303,],
    )
    assert_series_is_6dp_close(
        df["PValue"], [0.002928, 0.325073, 0.587756,],
    )
    assert_series_is_6dp_close(
        df["QValue"], [0.008783, 0.487609, 0.587756,],
    )
    assert list(df["numCellLines"]) == [9, 9, 10]


def test_run_custom_analysis_assoc_empty_table(
    tmpdir, minimal_db: SessionWithUser, settings, monkeypatch
):
    """
    Limma can return an empty table under certain circumstance, e.g.
        if we had confounders, when query and confounder vectors are the same
        data matrix is very structured (e.g. an incrementing range) and has same structure as the query

    We want to throw Exception in these situations
    """

    @contextmanager
    def mock_db_context(user, **kwargs):
        yield minimal_db

    def get_test_settings():
        return settings

    monkeypatch.setattr(
        analysis_tasks, "get_settings", get_test_settings,
    )

    monkeypatch.setattr(
        analysis_tasks, "db_context", mock_db_context,
    )

    cell_lines = ["ACH-0000{}".format(x) for x in range(10)]
    with pytest.raises(Exception):
        query_and_counfounder = list(range(10))
        _run_custom_analysis_test_wrapper(
            tmpdir=tmpdir,
            analysis_type=AnalysisType.association,
            vector_is_dependent=True,
            model_ids=cell_lines,
            minimal_db=minimal_db,
            settings=settings,
            test_empty_assoc_table=True,
            vector_models=cell_lines,
            vector_data=query_and_counfounder,
        )


def test_run_custom_analysis_no_variance_vector(
    tmpdir, minimal_db: SessionWithUser, settings, monkeypatch
):
    """
    We previously had an issue in aligning pearson and limma results
        There are certain cirumstances, such as when one data vector is a vector of just one value, that limma returns results but pearson does not
        For a further description on this issue, see the comment containing "pearson df should not drop NAs" in compute/tasks.py
    Test that when a data vector only has one value,
        The code runs
        Pearson does not return results
        Limma results return as expected
    """

    @contextmanager
    def mock_db_context(user, **kwargs):
        yield minimal_db

    def get_test_settings():
        return settings

    monkeypatch.setattr(
        analysis_tasks, "get_settings", get_test_settings,
    )

    monkeypatch.setattr(
        analysis_tasks, "db_context", mock_db_context,
    )

    cell_lines = ["ACH-0000{}".format(x) for x in range(10)]

    def _make_data_with_no_variance_for_feature_0():
        data = numpy.zeros((3, 10))
        data[0, :] = [1] * 10  # A has no variance in the vector
        data[1, :] = [-5, 4, 5, 6, 7, 8, 9, 10, 1, 2]
        data[2, :] = [1, 2, -5, 4, 5, -6, -7, -8, 9, 10]
        return data.transpose()

    # test that the code runs fine
    df, result = _run_custom_analysis_test_wrapper(
        tmpdir=tmpdir,
        analysis_type=AnalysisType.association,
        minimal_db=minimal_db,
        settings=settings,
        vector_is_dependent=True,
        model_ids=cell_lines,
        vector_models=cell_lines,
        vector_data=list(range(10)),
        data=_make_data_with_no_variance_for_feature_0(),
    )

    assert isclose(df["PValue"][0], 0.3739821983262783)
    assert isclose(df["PValue"][1], 0.5877560648491652)
    assert not "Gene A Label" in df["label"].values
    assert "Gene B Label" in df["label"].values
    assert "Gene C Label" in df["label"].values


def test_no_overlap(
    tmpdir,
    monkeypatch,
    celery_app,
    celery_worker,
    minimal_db: SessionWithUser,
    client: TestClient,
    settings,
):
    @contextmanager
    def mock_db_context(user, **kwargs):
        yield minimal_db

    def get_test_settings():
        return settings

    monkeypatch.setattr(
        analysis_tasks, "get_settings", get_test_settings,
    )

    monkeypatch.setattr(analysis_tasks, "db_context", mock_db_context)

    monkeypatch.setattr(
        analysis_tasks,
        "run_custom_analysis",
        celery_app.task(bind=True)(run_custom_analysis),
    )

    models_a = [f"CL{i}" for i in range(2)]
    models_b = [f"CL{i}" for i in range(2, 4)]
    user = settings.admin_users[0]
    headers = {"X-Forwarded-User": settings.admin_users[0]}
    factories.feature_type(minimal_db, user, "gene")
    dataset1 = factories.matrix_dataset(
        minimal_db,
        settings,
        data_file=factories.matrix_csv_data_file_with_values(
            feature_ids=["A", "B", "C", "D"],
            sample_ids=models_a,
            values=TestData._make_data(),
        ),
        feature_type="gene",
        value_type=ValueType.continuous,
    )

    dataset2 = factories.matrix_dataset(
        minimal_db,
        settings,
        data_file=factories.matrix_csv_data_file_with_values(
            feature_ids=["A", "B", "C", "D"],
            sample_ids=models_b,
            values=TestData._make_data(),
        ),
        feature_type="gene",
        value_type=ValueType.continuous,
    )

    dataset_id = dataset1.id
    assert dataset_id != None

    data = {
        "user": user,
        "queryValues": None,
        "queryCellLines": [],
        "analysisType": "association",
        "datasetId": dataset_id,
        "queryId": None,
        "queryFeatureId": "A",
        "queryDatasetId": dataset2.id,
        "vectorVariableType": "dependent",
    }

    r = client.post(
        "/compute/compute_univariate_associations", json=(data), headers=headers,
    )

    assert r.status_code == 200, r.status_code
    result = r.json()
    assert result["state"] == "FAILURE"
    assert (
        result["message"]
        == "No cell lines in common between query and dataset searched"
    )


def test_fast_cor_with_p_and_q_values_with_missing():
    # x is n x m, y is n x o, so the result should be m x o
    x = np.array(
        [
            [1, 2, 3, 4, 5],
            [0, 0, np.nan, 0, 0],
            [3, np.nan, 8, 2, 1],
            [2, 4, 6, 8, 10],
            [1.5, 2.5, 2.8, 2.9, np.nan],
        ]
    )

    y = np.array(
        [
            [1, 2, 3, 4, 5],
            [66, 55, np.nan, 999, 5],
            [6, 2, np.nan, 2, 7],
            [2, 4, 6, 8, 10],
            [1, 2, 3, np.nan, 5],
            [1.1, 2.2, 3.3, 4.4, 5.5],
        ]
    )

    def progress_callback(fraction_complete):
        assert fraction_complete >= 0 and fraction_complete <= 1

    expected_pearson = np.zeros(shape=(x.shape[0], y.shape[0]))
    expected_p = np.zeros(shape=(x.shape[0], y.shape[0]))
    for i_x, col_x in enumerate(x):
        for i_y, col_y in enumerate(y):
            nas = np.logical_or(np.isnan(col_x), np.isnan(col_y))
            pearson, p = stats.pearsonr(col_x[~nas], col_y[~nas])
            expected_pearson[i_x, i_y] = pearson
            expected_p[i_x, i_y] = p

    (
        actual_pearson,
        actual_p,
        actual_q,
        actual_num_used,
    ) = fast_cor_with_p_and_q_values_with_missing(
        x.transpose(), y.transpose(), progress_callback=progress_callback
    )

    np.greater_equal(actual_q, actual_p)

    assert np.allclose(expected_pearson, actual_pearson, rtol=0.01, equal_nan=True)
    assert np.allclose(expected_p, actual_p, rtol=0.01, equal_nan=True)
