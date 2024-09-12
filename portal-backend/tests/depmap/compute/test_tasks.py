from dataclasses import dataclass
import json
import pytest
from math import isclose
from scipy import stats
import numpy as np
import numpy.random
import pandas as pd
from flask import url_for
from typing import Callable, List, Optional
import pytest

from depmap import data_access
from depmap.interactive import interactive_utils
from depmap.compute.analysis_tasks import run_custom_analysis
from depmap.compute.models import CustomCellLineGroup
from depmap_compute.models import AnalysisType
from depmap_compute.analysis_tasks_interface import Feature
from depmap.utilities.exception import UserError
from depmap.vector_catalog.models import SliceSerializer, SliceRowType
from depmap_compute.analysis_tasks_interface import (
    count_num_non_nan_per_row,
    fast_cor_with_p_and_q_values_with_missing,
    #    prep_and_run_linear_model,
    prep_and_run_py_pearson,
    reformat_pearson_result,
)
from depmap.access_control import all_records_visible
from tests.depmap.compute.custom_analysis_test_data import (
    get_test_local_run_pearson_data,
    get_test_run_lm_data,
    get_test_run_pearson_subsetted_data,
)
from tests.utilities import interactive_test_utils
from tests.factories import (
    BiomarkerDatasetFactory,
    DependencyDatasetFactory,
    MatrixFactory,
    GeneFactory,
    CellLineFactory,
)

# in HDF5, dim_0 corresponds to entities which are accessed by column in R, by row in python
# in HDF5, dim_1 corresponds to cell lines which are accessed by row in R, by column in python


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
    def _make_data():
        # just some dummy data which we can use to test output values from lmstat and pearson cor
        data = numpy.zeros((3, 10))
        data[0, :] = [1, 2, -5, 4, 5, 6, 7, np.nan, 9, 10]
        data[1, :] = [-5, 4, 5, 6, -np.inf, 8, 9, 10, 1, 2]
        data[2, :] = [1, 2, -5, 4, 5, -6, -7, -8, 9, 10]
        return data

    @staticmethod
    def setup_db_objects(app, db, tmpdir, data):
        # We don't really need to seed the random number generator, because these tests don't actually care about the
        # specific values of the matrices. Out of habit, I'm seeding just to make debugging easier by making sure the
        # values are stable from run to run.
        numpy.random.seed(0)
        n_entities, n_cell_lines = data.shape

        # always create with arxspan ids starting at 0, thus guaranteeing that they match with a potential cell line subset
        cell_lines = [CellLineFactory() for _ in range(n_cell_lines)]
        # we specify gene labels so that we can stably identify a row
        genes = [GeneFactory(label="gene_{}".format(i)) for i in range(n_entities)]

        matrix = MatrixFactory(entities=genes, cell_lines=cell_lines, data=data)
        dataset = DependencyDatasetFactory(display_name="sample", matrix=matrix)
        db.session.commit()
        interactive_test_utils.reload_interactive_config()

        results_dir = str(tmpdir.join("results"))
        dataset_id = dataset.name.name

        return dataset_id, results_dir, cell_lines


def _run_custom_analysis_test_wrapper(
    tmpdir,
    analysis_type: AnalysisType,
    value_query_vector,
    vector_is_dependent: Optional[bool],
    value_query_cell_lines,
    app,
    empty_db_mock_downloads,
    data,
):
    """
    Named with test wrapper to not cause confusion that we are directly calling the function being tested
    """
    with all_records_visible(allow_unsafe_promotion=True):
        dataset_id, results_dir, cell_lines = TestData.setup_db_objects(
            app, empty_db_mock_downloads, tmpdir, data
        )

    # compare the first column with all other columns
    result = run_custom_analysis(
        analysis_type=analysis_type.name,
        cell_line_query_vector=[cl.depmap_id for cl in cell_lines],
        value_query_vector=value_query_vector,
        vector_is_dependent=vector_is_dependent,
        parameters=dict(
            query=dict(
                queryValues=value_query_vector,
                queryCellLines=value_query_cell_lines,
                vectorIsDependent=vector_is_dependent,
            ),
            datasetId=100,
        ),
        result_dir=results_dir,
        user_id="sample@sample.com",
        dataset_id=dataset_id,
    )

    with open(result["data_json_file_path"], "rt") as fd:
        df = pd.DataFrame(json.load(fd))

    return df, result


def test_run_custom_analysis_two_class(tmpdir, app, empty_db_mock_downloads):
    in_cell_lines = ["ACH-0000{}".format(x) for x in range(5)]
    out_cell_lines = ["ACH-0000{}".format(x) for x in range(6, 11)]
    all_cell_lines = in_cell_lines + out_cell_lines
    df, result = _run_custom_analysis_test_wrapper(
        tmpdir=tmpdir,
        analysis_type=AnalysisType.two_class,
        value_query_vector=[1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
        vector_is_dependent=True,
        value_query_cell_lines=all_cell_lines,
        app=app,
        empty_db_mock_downloads=empty_db_mock_downloads,
        data=TestData._make_data(),
    )
    row = df[df["label"] == "gene_0"]

    assert ((row["EffectSize"] - (6.6)) < 0.0001).all()

    assert result["numCellLinesUsed"] == len(all_cell_lines)

    assert (
        interactive_utils.get_row_of_values_from_slice_id(
            result["filterSliceId"]
        ).index.tolist()
        == all_cell_lines
    )

    assert (
        interactive_utils.get_row_of_values_from_slice_id(
            result["colorSliceId"]
        ).index.tolist()
        == in_cell_lines
    )


@pytest.mark.parametrize("vector_is_dependent", [True, False])
def test_run_custom_analysis_two_class_with_zero_var_features(
    tmpdir, app, empty_db_mock_downloads, vector_is_dependent
):
    in_cell_lines = ["ACH-0000{}".format(x) for x in range(5)]
    out_cell_lines = ["ACH-0000{}".format(x) for x in range(5, 10)]
    all_cell_lines = in_cell_lines + out_cell_lines

    data = numpy.zeros((3, 10))
    data[0, :] = [0, 1, 1, 1, 2, 2, 3, 3, 3, 4]
    data[1, :] = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    data[2, :] = [2, 3, 3, 3, 4, 0, 1, 1, 1, 2]

    df, result = _run_custom_analysis_test_wrapper(
        tmpdir=tmpdir,
        analysis_type=AnalysisType.two_class,
        value_query_vector=[1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
        vector_is_dependent=vector_is_dependent,
        value_query_cell_lines=all_cell_lines,
        app=app,
        empty_db_mock_downloads=empty_db_mock_downloads,
        data=data,
    )

    # make sure the labels for only the non-zero variance features are returned
    assert set(["gene_0", "gene_2"]) == set(df["label"])


def assert_series_is_6dp_close(series, expected_values):
    assert len(series) == len(expected_values)
    for val, expected in zip(list(series), expected_values):
        assert isclose(
            val, expected, abs_tol=1e-06
        ), "{} not close to {}".format(  # match the first 6 decimals
            val, expected
        )


def test_run_custom_analysis_pearson(tmpdir, app, empty_db_mock_downloads):
    """
    Test running linear association, including
        values are correct
        structure of the response
        cell line group is created and can be retrieved
    """
    num_custom_cell_line_groups = len(CustomCellLineGroup.query.all())

    cell_lines = ["ACH-0000{}".format(x) for x in range(10)]
    df, result = _run_custom_analysis_test_wrapper(
        tmpdir=tmpdir,
        analysis_type=AnalysisType.pearson,
        value_query_vector=list(range(10)),
        vector_is_dependent=None,
        value_query_cell_lines=cell_lines,
        app=app,
        empty_db_mock_downloads=empty_db_mock_downloads,
        data=TestData._make_data(),
    )
    assert len(df["label"]) == 3 and len(df["vectorId"]) == 3
    df.sort_values(["vectorId"], inplace=True)
    assert_series_is_6dp_close(df["Cor"], TestData.expected_pearsonCor)
    assert_series_is_6dp_close(df["PValue"], TestData.expected_pearsonPValue)
    assert_series_is_6dp_close(df["QValue"], TestData.expected_pearsonQValue)
    assert list(df["numCellLines"]) == [9, 9, 10]

    assert result["numCellLinesUsed"] == len(cell_lines)
    assert (
        interactive_utils.get_row_of_values_from_slice_id(
            result["filterSliceId"]
        ).index.tolist()
        == cell_lines
    )

    # in group cell lines should not be defined for assoc. only one cell ling group should have been written
    assert result["colorSliceId"] == None
    assert len(CustomCellLineGroup.query.all()) == num_custom_cell_line_groups + 1


# @pytest.mark.skip(reason="rpy2.interface has no attribute 'INTSXP")
def test_run_custom_analysis_assoc_vector_is_dependent_true(
    tmpdir, app, empty_db_mock_downloads
):
    """
    Test running linear association, including
        values are correct
        structure of the response
        cell line group is created and can be retrieved
    """
    num_custom_cell_line_groups = len(CustomCellLineGroup.query.all())

    cell_lines = ["ACH-0000{}".format(x) for x in range(10)]
    df, result = _run_custom_analysis_test_wrapper(
        tmpdir=tmpdir,
        analysis_type=AnalysisType.association,
        value_query_vector=list(range(10)),
        vector_is_dependent=True,
        value_query_cell_lines=cell_lines,
        app=app,
        empty_db_mock_downloads=empty_db_mock_downloads,
        data=TestData._make_data(),
    )
    assert len(df["label"]) == 3 and len(df["vectorId"]) == 3
    df.sort_values(["vectorId"], inplace=True)
    assert_series_is_6dp_close(df["EffectSize"], [0.555556, 0.225498, 0.089084])
    assert_series_is_6dp_close(df["PValue"], [0.005800, 0.354454, 0.587756])
    assert_series_is_6dp_close(df["QValue"], [0.017400, 0.531682, 0.587756])
    assert list(df["numCellLines"]) == [9, 9, 10]

    assert result["numCellLinesUsed"] == len(cell_lines)
    assert (
        interactive_utils.get_row_of_values_from_slice_id(
            result["filterSliceId"]
        ).index.tolist()
        == cell_lines
    )

    # in group cell lines should not be defined for assoc. only one cell ling group should have been written
    assert result["colorSliceId"] == None
    assert len(CustomCellLineGroup.query.all()) == num_custom_cell_line_groups + 1


# @pytest.mark.skip(reason="rpy2.interface has no attribute 'INTSXP")
def test_run_custom_analysis_assoc_with_vector_is_dependent_false(
    tmpdir, app, empty_db_mock_downloads
):
    """
    Test running with a confounder supplied
    """
    cell_lines = ["ACH-0000{}".format(x) for x in range(10)]

    df, result = _run_custom_analysis_test_wrapper(
        tmpdir=tmpdir,
        analysis_type=AnalysisType.association,
        value_query_vector=list(range(10)),
        vector_is_dependent=False,
        value_query_cell_lines=cell_lines,
        app=app,
        empty_db_mock_downloads=empty_db_mock_downloads,
        data=TestData._make_data(),
    )
    assert len(df["label"]) == 3 and len(df["vectorId"]) == 3
    df.sort_values(
        ["vectorId"], inplace=True
    )  # sort by label runs into problems with sorting gene_10, gene_11, gene_9
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


# @pytest.mark.skip(reason="rpy2.interface has no attribute 'INTSXP")
def test_run_custom_analysis_assoc_empty_table(tmpdir, app, empty_db_mock_downloads):
    """
    Limma can return an empty table under certain circumstance, e.g.
        if we had confounders, when query and confounder vectors are the same
        data matrix is very structured (e.g. an incrementing range) and has same structure as the query

    We want to throw Exception in these situations
    """

    cell_lines = ["ACH-0000{}".format(x) for x in range(10)]
    with pytest.raises(Exception):
        query_and_counfounder = list(range(10))
        _run_custom_analysis_test_wrapper(
            tmpdir=tmpdir,
            analysis_type=AnalysisType.association,
            value_query_vector=query_and_counfounder,
            vector_is_dependent=True,
            value_query_cell_lines=cell_lines,
            app=app,
            empty_db_mock_downloads=empty_db_mock_downloads,
            data=numpy.ones((3, 10)),
        )


# def test_run_lm():
#     data = get_test_run_lm_data()
#     dataset = data["dataset"]
#     features = data["features"]
#     value_query_vector = data["value_query_vector"]
#     vector_is_dependent = data["vector_is_dependent"]
#     mat_file_name = data["mat_file_name"]
#     result_task_dir = data["result_task_dir"]
#
#     # is_transpose needs to always be False - assert this higher up and hardcode
#     # to false inside prep_run_linear_model
#     df =
#     # sort by descending absolute
#     df = df.reindex(df.Cor.abs().sort_values(ascending=False).index)
#
#     # Note that the df returned for pearson may have a different number rows from the df returned from the linear model
#     # The df may also have fewer indices than row indices
#     # Edge cases that caused these may be one-point rows, two-point rows, vector with no variance
#     # (This is just a warning, unclear which of these situations cause dropping rows. no variance vector definitely does))#
#
#     num_cell_lines_used_in_calc = count_num_non_nan_per_row(dataset)
#
#     # Add metadata
#     row_labels = []
#     vector_ids = []
#     num_cell_lines = []
#
#     # We assume num_cell_lines_used in calc is ordered in ascending
#     # order of feature position based on the previous dep_mat_row_indices
#     sorted_df_index = sorted(df.index)
#
#     for i in list(df.index):
#         index = sorted_df_index.index(i)
#         row_labels.append(features[index].label)
#         vector_ids.append(features[index].slice_id)
#         # need to do this because num_cell_lines_used_in_calc isn't mapped by index, but rather by position
#         num_cell_lines.append(num_cell_lines_used_in_calc[index])
#
#     df["label"] = row_labels
#     df["vectorId"] = vector_ids
#     df["numCellLines"] = num_cell_lines
#
#     assert row_labels == [
#         "MED1",
#         "TRIL",
#         "SOX10",
#         "KDM7A",
#         "NRAS",
#         "MAP4K4",
#         "PSG7",
#         "HNF1B",
#         "F8A1",
#         "ANOS1",
#         "UNC93B1",
#     ]
#
#     df["vectorId"] = vector_ids
#     assert vector_ids == [
#         "slice/RNAi_merged/7/entity_id",
#         "slice/RNAi_merged/14/entity_id",
#         "slice/RNAi_merged/11/entity_id",
#         "slice/RNAi_merged/5/entity_id",
#         "slice/RNAi_merged/9/entity_id",
#         "slice/RNAi_merged/6/entity_id",
#         "slice/RNAi_merged/10/entity_id",
#         "slice/RNAi_merged/4/entity_id",
#         "slice/RNAi_merged/3/entity_id",
#         "slice/RNAi_merged/2/entity_id",
#         "slice/RNAi_merged/15/entity_id",
#     ]
#     df["numCellLines"] = num_cell_lines
#     assert num_cell_lines == [10, 6, 10, 6, 10, 10, 10, 10, 6, 8, 6]


def test_local_run_pearson_subsetted():
    data = get_test_run_pearson_subsetted_data()
    value_query_vector: List[int] = data["value_query_vector"]
    features: List[Feature] = data["features"]
    dataset: np.ndarray = data["dataset"]

    assert np.isnan(value_query_vector).sum() == 0

    def progress_callback(fraction_complete):
        pass  # don't care about this for test

    (
        pearson_cor,
        p_vals,
        q_vals,
        _num_cell_lines_used_in_calc,
    ) = prep_and_run_py_pearson(value_query_vector, dataset, progress_callback)

    # verify that the indices of the dep_mat_col_indices list can line up with that of the pearson list
    assert len(features) == len(pearson_cor)  # pearson_cor is a numpy array

    df = pd.DataFrame({"Cor": pearson_cor, "PValue": p_vals, "QValue": q_vals,})

    # sort by descending absolute
    df = df.reindex(df.Cor.abs().sort_values(ascending=False).index)

    df, metadata = reformat_pearson_result(
        df, dataset, _num_cell_lines_used_in_calc, features
    )

    row_labels = metadata["row_labels"]
    vector_ids = metadata["vector_ids"]
    num_cell_lines = metadata["num_cell_lines"]

    df["label"] = row_labels
    assert row_labels == [
        "MED1",
        "ANOS1",
        "KDM7A",
        "SOX10",
        "UNC93B1",
        "PSG7",
        "MAP4K4",
        "TRIL",
        "F8A1",
        "NRAS",
        "HNF1B",
    ]
    df["vectorId"] = vector_ids
    assert vector_ids == [
        "slice/RNAi_merged/7/entity_id",
        "slice/RNAi_merged/2/entity_id",
        "slice/RNAi_merged/5/entity_id",
        "slice/RNAi_merged/11/entity_id",
        "slice/RNAi_merged/15/entity_id",
        "slice/RNAi_merged/10/entity_id",
        "slice/RNAi_merged/6/entity_id",
        "slice/RNAi_merged/14/entity_id",
        "slice/RNAi_merged/3/entity_id",
        "slice/RNAi_merged/9/entity_id",
        "slice/RNAi_merged/4/entity_id",
    ]
    df["numCellLines"] = num_cell_lines
    assert num_cell_lines == [7, 6, 3, 7, 5, 7, 7, 3, 5, 7, 7]


def test_local_run_pearson_custom_dataset_upload():
    pass


# test no subset don't forget to also test with subset
def test_local_run_pearson():
    data = get_test_local_run_pearson_data()
    value_query_vector: List[int] = data["value_query_vector"]
    features: List[Feature] = data["features"]
    dataset: np.ndarray = data["dataset"]

    assert np.isnan(value_query_vector).sum() == 0

    def progress_callback(fraction_complete):
        pass  # don't care about this for test

    (
        pearson_cor,
        p_vals,
        q_vals,
        _num_cell_lines_used_in_calc,
    ) = prep_and_run_py_pearson(value_query_vector, dataset, progress_callback)

    # verify that the indices of the dep_mat_col_indices list can line up with that of the pearson list
    assert len(features) == len(pearson_cor)  # pearson_cor is a numpy array

    df = pd.DataFrame({"Cor": pearson_cor, "PValue": p_vals, "QValue": q_vals,})

    # sort by descending absolute
    df = df.reindex(df.Cor.abs().sort_values(ascending=False).index)

    df, metadata = reformat_pearson_result(
        df, dataset, _num_cell_lines_used_in_calc, features
    )

    row_labels = metadata["row_labels"]
    vector_ids = metadata["vector_ids"]
    num_cell_lines = metadata["num_cell_lines"]

    df["label"] = row_labels
    assert row_labels == [
        "TRIL",
        "KDM7A",
        "MED1",
        "MAP4K4",
        "SOX10",
        "NRAS",
        "F8A1",
        "UNC93B1",
        "PSG7",
        "HNF1B",
        "ANOS1",
    ]
    df["vectorId"] = vector_ids
    assert vector_ids == [
        "slice/RNAi_merged/14/entity_id",
        "slice/RNAi_merged/5/entity_id",
        "slice/RNAi_merged/7/entity_id",
        "slice/RNAi_merged/6/entity_id",
        "slice/RNAi_merged/11/entity_id",
        "slice/RNAi_merged/9/entity_id",
        "slice/RNAi_merged/3/entity_id",
        "slice/RNAi_merged/15/entity_id",
        "slice/RNAi_merged/10/entity_id",
        "slice/RNAi_merged/4/entity_id",
        "slice/RNAi_merged/2/entity_id",
    ]
    df["numCellLines"] = num_cell_lines
    assert num_cell_lines == [6, 6, 10, 10, 10, 10, 6, 6, 10, 10, 8]


# @pytest.mark.skip(reason="rpy2.interface has no attribute 'INTSXP")
def test_run_custom_analysis_no_variance_vector(tmpdir, app, empty_db_mock_downloads):
    """
    We previously had an issue in aligning pearson and limma results
        There are certain cirumstances, such as when one data vector is a vector of just one value, that limma returns results but pearson does not
        For a further description on this issue, see the comment containing "pearson df should not drop NAs" in compute/tasks.py
    Test that when a data vector only has one value,
        The code runs
        Pearson does not return results
        Limma results return as expected
    """

    cell_lines = ["ACH-0000{}".format(x) for x in range(10)]

    def _make_data_with_no_variance_for_gene_0():
        data = numpy.zeros((3, 10))
        data[0, :] = [1] * 10  # gene_0 has no variance in the vector
        data[1, :] = [-5, 4, 5, 6, 7, 8, 9, 10, 1, 2]
        data[2, :] = [1, 2, -5, 4, 5, -6, -7, -8, 9, 10]
        return data

    # test that the code runs fine
    df, result = _run_custom_analysis_test_wrapper(
        tmpdir=tmpdir,
        analysis_type=AnalysisType.association,
        value_query_vector=list(range(10)),
        vector_is_dependent=True,
        value_query_cell_lines=cell_lines,
        app=app,
        empty_db_mock_downloads=empty_db_mock_downloads,
        data=_make_data_with_no_variance_for_gene_0(),
    )

    assert not "gene_0" in df["label"].values
    assert "gene_1" in df["label"].values
    assert "gene_2" in df["label"].values


class DelayReturnValue:
    id = "ID"
    state = "RUNNING"

    def ready(self):
        return False


def test_no_overlap(empty_db_mock_downloads, app):
    cell_lines_a = [CellLineFactory(cell_line_name="CL" + str(i)) for i in range(2)]
    cell_lines_b = [CellLineFactory(cell_line_name="CL" + str(i)) for i in range(2, 4)]
    genes = [GeneFactory() for _ in range(2)]

    matrix_a = MatrixFactory(entities=genes, cell_lines=cell_lines_a)
    dataset_a = DependencyDatasetFactory(display_name="ds1", matrix=matrix_a)

    matrix_b = MatrixFactory(entities=genes, cell_lines=cell_lines_b)
    dataset_b = BiomarkerDatasetFactory(display_name="ds2", matrix=matrix_b)

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    sliceId = SliceSerializer.encode_slice_id(
        dataset_b.name.name, genes[0].entity_id, SliceRowType.entity_id
    )

    parameters = {
        "analysisType": "association",
        "queryCellLines": None,
        "queryValues": None,
        "vectorVariableType": "dependent",
        "datasetId": dataset_a.name.name,
        "queryId": sliceId,
    }
    with app.test_client() as c:
        # r = c.post(url_for("compute.lmstats"), data=json.dumps(parameters), content_type='application/json')
        r = c.post(
            url_for("compute.compute_univariate_associations"),
            data=json.dumps(parameters),
            content_type="application/json",
        )
    assert r.status_code == 200, r.status_code
    result = json.loads(r.data.decode("utf8"))
    assert result["state"] == "FAILURE"
    assert (
        result["message"]
        == "No cell lines in common between query and dataset searched"
    )


def test_fast_cor_with_p_and_q_values_with_missing(app):
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
