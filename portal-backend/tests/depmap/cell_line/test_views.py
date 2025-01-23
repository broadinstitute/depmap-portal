from depmap.cell_line.models_new import DepmapModel
from flask import url_for
import json
import math
import numpy as np
import pandas as pd
import pytest

from depmap.cell_line.views import (
    convert_to_z_score_matrix,
    get_all_cell_line_gene_effects,
    get_all_cell_line_compound_sensitivity,
    get_cell_line_col_index,
    get_related_models,
    get_rows_with_lowest_z_score,
)
from depmap.dataset.models import DependencyDataset
from tests.factories import (
    CompoundFactory,
    CompoundExperimentFactory,
    LineageFactory,
    GeneFactory,
    DependencyDatasetFactory,
    MatrixFactory,
    DepmapModelFactory,
)
from tests.utilities import interactive_test_utils


def test_render_view_cell_line(app, populated_db):
    """
    Test that the cell line page for every cell line in the db renders 
    """
    depmap_ids = [cell_line.model_id for cell_line in DepmapModel.query.all()]
    with app.test_client() as c:
        for depmap_id in depmap_ids:
            try:
                r = c.get(url_for("cell_line.view_cell_line", cell_line_name=depmap_id))
            except Exception as e:
                raise Exception(
                    "{} cell line page failed to render".format(depmap_id)
                ) from e
            assert r.status_code == 200, r.status_code

        # also verify we can look up cell lines by CCLE name
        r = c.get(url_for("cell_line.view_cell_line", cell_line_name="C32_SKIN"))
        assert r.status_code == 200


def test_render_view_cell_line_404(app, populated_db):
    """
    Test that nonexistent cell line returns 404
    """
    with app.test_client() as c:
        r = c.get(url_for("cell_line.view_cell_line", cell_line_name="notacellline"))
        assert r.status_code == 404, r.status_code


def test_validate_cell_lines(app, empty_db_mock_downloads):
    """
    Test that the validate cell lines endpoint returns as expected
    """
    with app.test_client() as c:
        r = c.post(
            url_for("cell_line.validate_cell_lines"),
            data={"cell_lines": json.dumps(["test_line"])},
        )
        assert r.status_code == 200, r.status_code
        response = json.loads(r.data.decode("utf8"))
        print(response)
        assert response["invalidCellLines"] == ["test_line"]
        assert response["validCellLines"] == []


def test_view_cell_line_unknown_lineage(app, empty_db_mock_downloads):
    """
    Test that page renders without Lineage
    """

    cell_1 = DepmapModelFactory(
        cell_line_name="with_lin", oncotree_lineage=[LineageFactory(name="lung")]
    )
    cell_2 = DepmapModelFactory(
        cell_line_name="without_lin", oncotree_lineage=[LineageFactory(name="unknown")]
    )
    kwargs = {}
    gene1 = GeneFactory(label="NRAS")
    gene2 = GeneFactory(label="MSL2")
    kwargs["entities"] = [gene1, gene2]
    kwargs["cell_lines"] = [cell_1, cell_2]
    kwargs["data"] = np.array([[5, 2], [1, 4]])

    # temporary until we remove CellLine table and fix MatrixFactory to only work with DepmapModel
    kwargs["using_depmap_model_table"] = True

    matrix = MatrixFactory(**kwargs)
    DependencyDatasetFactory(
        matrix=matrix, name=DependencyDataset.DependencyEnum.Chronos_Combined
    )
    DependencyDatasetFactory(
        matrix=matrix, name=DependencyDataset.DependencyEnum.RNAi_merged
    )
    empty_db_mock_downloads.session.flush()

    # verify that the cell line pages load
    with app.test_client() as c:
        r = c.get(url_for("cell_line.view_cell_line", cell_line_name="with_lin"))
        assert r.status_code == 200, r.status_code

    with app.test_client() as c:
        r = c.get(url_for("cell_line.view_cell_line", cell_line_name="without_lin"))
        assert r.status_code == 200, r.status_code


def test_download_gene_effects(app, empty_db_mock_downloads):
    dataset_name = DependencyDataset.DependencyEnum.RNAi_merged
    cell_lines = [DepmapModelFactory() for _ in range(3)]
    genes = [GeneFactory() for _ in range(3)]
    matrix = MatrixFactory(
        data=[[2, 3, 4], [0, 2, 1], [np.NaN, np.NaN, np.NaN]],
        cell_lines=cell_lines,
        entities=genes,
        using_depmap_model_table=True,
    )
    DependencyDatasetFactory(matrix=matrix, name=dataset_name, priority=1)
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    # Verify that data loads
    with app.test_client() as c:
        rnai_result = c.get(
            url_for(
                "cell_line.download_gene_effects",
                dataset_type="rnai",
                model_id=cell_lines[0].model_id,
            )
        )
        assert rnai_result.status_code == 200, rnai_result.status_code

    # Verify that a the endpiont returns Not Found when given invalid arguments
    with app.test_client() as c:
        # Invalid dataset type
        rnai_result = c.get(
            url_for(
                "cell_line.download_gene_effects",
                dataset_type="not_real",
                model_id=cell_lines[0].model_id,
            )
        )
        assert rnai_result.status_code == 404, rnai_result.status_code
        # Invalid depmap ID
        crispr_result = c.get(
            url_for(
                "cell_line.download_gene_effects", dataset_type="rnai", model_id="fake"
            )
        )
        assert crispr_result.status_code == 404, crispr_result.status_code


def test_download_compound_sensitivities(app, empty_db_mock_downloads):
    dataset_name = DependencyDataset.DependencyEnum.Rep_all_single_pt
    cell_lines = [DepmapModelFactory() for _ in range(3)]
    compounds = [CompoundFactory() for _ in range(3)]
    compound_experiments = [CompoundExperimentFactory(compound=c) for c in compounds]
    matrix = MatrixFactory(
        data=[[2, 3, 4], [0, 2, 1], [np.NaN, np.NaN, np.NaN]],
        cell_lines=cell_lines,
        entities=compound_experiments,
        using_depmap_model_table=True,
    )
    DependencyDatasetFactory(matrix=matrix, name=dataset_name, priority=1)
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    # Verify that data loads
    with app.test_client() as c:
        result = c.get(
            url_for(
                "cell_line.download_compound_sensitivities",
                model_id=cell_lines[0].model_id,
            )
        )
        assert result.status_code == 200, result.status_code

    # Verify that a the endpiont returns Not Found when given invalid arguments
    with app.test_client() as c:
        # Invalid depmap ID
        result = c.get(
            url_for("cell_line.download_compound_sensitivities", model_id="fake")
        )
        assert result.status_code == 404, result.status_code


def test_get_cell_line_col_index(empty_db_mock_downloads):
    dataset_name = DependencyDataset.DependencyEnum.Avana
    cell_lines = [DepmapModelFactory() for _ in range(3)]
    genes = [GeneFactory() for _ in range(2)]
    matrix = MatrixFactory(
        data=[[2, 3, 4], [0, 2, 1]],
        cell_lines=cell_lines,
        entities=genes,
        using_depmap_model_table=True,
    )
    DependencyDatasetFactory(matrix=matrix, name=dataset_name)
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    # Check that the function can get the correct index for each model id
    assert 0 == get_cell_line_col_index(dataset_name, cell_lines[0].model_id)
    assert 1 == get_cell_line_col_index(dataset_name, cell_lines[1].model_id)
    assert 2 == get_cell_line_col_index(dataset_name, cell_lines[2].model_id)


def test_get_related_models(empty_db_mock_downloads):
    cell_line_not_related_model = DepmapModelFactory(
        model_id="ACH-1", patient_id="not_related"
    )
    cell_line_related1 = DepmapModelFactory(model_id="ACH-2", patient_id="related")
    cell_line_related2 = DepmapModelFactory(model_id="ACH-3", patient_id="related")
    cell_line_related3 = DepmapModelFactory(model_id="ACH-4", patient_id="related")
    test_line = DepmapModelFactory(model_id="test_model", patient_id="related")

    related_models = get_related_models(test_line.patient_id, test_line.model_id)

    assert related_models == [
        {"model_id": "ACH-2", "url": "/cell_line/ACH-2"},
        {"model_id": "ACH-3", "url": "/cell_line/ACH-3"},
        {"model_id": "ACH-4", "url": "/cell_line/ACH-4"},
    ]


def test_get_related_models_none_related(empty_db_mock_downloads):
    c1 = DepmapModelFactory(model_id="ACH-1", patient_id="not_related")
    c2 = DepmapModelFactory(model_id="ACH-2", patient_id="a")
    c3 = DepmapModelFactory(model_id="ACH-3", patient_id="b")
    c4 = DepmapModelFactory(model_id="ACH-4", patient_id="c")
    test_line = DepmapModelFactory(model_id="test_model", patient_id="test")

    related_models = get_related_models(test_line.patient_id, test_line.model_id)

    assert related_models == []


def test_get_all_cell_line_gene_effects(empty_db_mock_downloads):
    dataset_name = DependencyDataset.DependencyEnum.Avana
    cell_lines = [DepmapModelFactory() for _ in range(3)]

    genes = [GeneFactory() for _ in range(3)]
    matrix = MatrixFactory(
        data=[[2, 3, 4], [0, 2, 1], [np.NaN, np.NaN, np.NaN]],
        cell_lines=cell_lines,
        entities=genes,
        using_depmap_model_table=True,
    )
    DependencyDatasetFactory(matrix=matrix, name=dataset_name)
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    actual_df = get_all_cell_line_gene_effects(
        dataset_name=dataset_name.name, model_id=cell_lines[0].model_id
    )

    # Check that all non-null rows are included and have the correct gene names
    assert len(actual_df.index.values.tolist()) == 2
    assert genes[0].label in actual_df.index.values.tolist()
    assert genes[1].label in actual_df.index.values.tolist()

    # validate each column's values: gene_effect, z_score, mean, stddev
    expected_gene_effects = [2, 0]
    expected_means = [np.mean([2, 3, 4]), np.mean([0, 2, 1])]
    expected_stddevs = [np.std([2, 3, 4], ddof=1), np.std([0, 2, 1], ddof=1)]
    expected_z_scores = [
        (expected_gene_effects[0] - expected_means[0]) / expected_stddevs[0],
        (expected_gene_effects[1] - expected_means[1]) / expected_stddevs[1],
    ]

    assert actual_df["gene_effect"].to_list() == expected_gene_effects
    assert actual_df["mean"].to_list() == expected_means
    assert actual_df["stddev"].to_list() == expected_stddevs
    assert actual_df["z_score"].to_list() == expected_z_scores


def test_get_all_cell_line_compound_sensitivities(empty_db_mock_downloads):
    dataset_name = DependencyDataset.DependencyEnum.Rep_all_single_pt
    cell_lines = [DepmapModelFactory() for _ in range(3)]
    compounds = [CompoundFactory() for _ in range(3)]
    compound_experiments = [CompoundExperimentFactory(compound=c) for c in compounds]
    matrix = MatrixFactory(
        data=[[2, 3, 4], [0, 2, 1], [np.NaN, np.NaN, np.NaN]],
        cell_lines=cell_lines,
        entities=compound_experiments,
        using_depmap_model_table=True,
    )
    DependencyDatasetFactory(matrix=matrix, name=dataset_name)
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    actual_df = get_all_cell_line_compound_sensitivity(
        dataset_name=dataset_name.name, model_id=cell_lines[0].model_id
    )

    # Check that all non-null rows are included and have the correct gene names
    assert actual_df.index.values.tolist() == [compounds[0].label, compounds[1].label]

    # validate each column's values: compound_sensitivity, z_score, mean, stddev
    expected_sensitivities = [2, 0]
    expected_means = [np.mean([2, 3, 4]), np.mean([0, 2, 1])]
    expected_stddevs = [np.std([2, 3, 4], ddof=1), np.std([0, 2, 1], ddof=1)]
    expected_z_scores = [
        (expected_sensitivities[0] - expected_means[0]) / expected_stddevs[0],
        (expected_sensitivities[1] - expected_means[1]) / expected_stddevs[1],
    ]

    assert actual_df["compound_sensitivity"].to_list() == expected_sensitivities
    assert actual_df["mean"].to_list() == expected_means
    assert actual_df["stddev"].to_list() == expected_stddevs
    assert actual_df["z_score"].to_list() == expected_z_scores


def test_convert_to_z_score_matrix():
    # assume rows are genes, and columns are cell lines
    example_input_df = pd.DataFrame([[2, 3, 4], [0, 2, 1]])

    # calculate expected values:
    gene1_mean = (2 + 3 + 4) / 3  # 3
    gene2_mean = (0 + 2 + 1) / 3  # 1
    gene1_std = math.sqrt(
        ((2 - gene1_mean) ** 2 + (3 - gene1_mean) ** 2 + (4 - gene1_mean) ** 2) / 2
    )
    gene2_std = math.sqrt(
        ((0 - gene2_mean) ** 2 + (2 - gene2_mean) ** 2 + (1 - gene2_mean) ** 2) / 2
    )
    expected_gene1_z_scores = [
        (2 - gene1_mean) / gene1_std,
        (3 - gene1_mean) / gene1_std,
        (4 - gene1_mean) / gene1_std,
    ]
    expected_gene2_z_scores = [
        (0 - gene2_mean) / gene2_std,
        (2 - gene2_mean) / gene2_std,
        (1 - gene2_mean) / gene2_std,
    ]

    # Test that the matrix of z scores has been calculated correctly
    actual_z_score_df = convert_to_z_score_matrix(example_input_df)
    actual_gene1_z_scores = actual_z_score_df.values.tolist()[0]
    actual_gene2_z_scores = actual_z_score_df.values.tolist()[1]

    assert len(actual_gene1_z_scores) == len(expected_gene1_z_scores)
    for a, b in zip(actual_gene1_z_scores, expected_gene1_z_scores):
        assert a == pytest.approx(b, 0.001)

    assert len(actual_gene2_z_scores) == len(expected_gene2_z_scores)
    for a, b in zip(actual_gene2_z_scores, expected_gene2_z_scores):
        assert a == pytest.approx(b, 0.001)


def test_get_rows_with_lowest_z_score(empty_db_mock_downloads):
    """Test that this outputs the expected format, ordered by z-score.
    Note: z-score calculations are tested above in test_convert_to_z_score_matrix.
    """
    dataset_name = DependencyDataset.DependencyEnum.Avana
    cell_lines = [DepmapModelFactory() for _ in range(3)]
    genes = [GeneFactory() for _ in range(13)]
    matrix = MatrixFactory(
        data=[
            [1, 2, 3],
            [4, 5, 6],
            [1, -200, 3],  # This should be the top result
            [4, 5, 6],
            [1, 2, 3],
            [4, 5, 6],
            [1, 2, np.NaN],
            [np.NaN, 5, 6],
            [1, 2, 3],
            [4, 5, 6],
            [1, 2, 3],
            [4, 5, 6],
            [np.NaN, np.NaN, np.NaN],
        ],
        cell_lines=cell_lines,
        entities=genes,
        using_depmap_model_table=True,
    )
    DependencyDatasetFactory(matrix=matrix, name=dataset_name)
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    # Validate that a result is returned for the correct cell line
    col_index = 1

    actual_result = get_rows_with_lowest_z_score(
        dataset_name=dataset_name.name,
        model_id=cell_lines[col_index].model_id,
    )
    assert actual_result["model_id"] == cell_lines[col_index].model_id
    assert actual_result["cell_line_col_index"] == col_index

    # Validate only 10 values are returned
    assert len(actual_result["labels"]) == 10
    assert len(actual_result["data"]) == 10

    # validate that the results are sorted by z score
    expected_top_gene = genes[2].label
    assert actual_result["labels"][0] == expected_top_gene

    # validate that no results have null values for cell line we care about
    # (they should be filtered out)
    for gene_data in actual_result["data"]:
        cell_line_gene_effect = gene_data[col_index]
        assert cell_line_gene_effect is not None
