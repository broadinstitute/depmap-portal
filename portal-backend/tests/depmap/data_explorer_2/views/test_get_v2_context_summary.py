import json

from flask import url_for
import gzip

from depmap.enums import DependencyEnum
from depmap.dataset.models import DependencyDataset
from tests.factories import (
    CompoundExperimentFactory,
    GeneFactory,
    MatrixFactory,
    DependencyDatasetFactory,
    CellLineFactory,
)
from tests.utilities import interactive_test_utils


def test_get_v2_context_summary_given_id_match(app, empty_db_mock_downloads):
    """
    Test the evaluation of v2 contexts with expressions 
    that use the special 'given_id' variable. 
    """
    genes = [
        GeneFactory(label="gene1", entrez_id=1),
        GeneFactory(label="gene2", entrez_id=2),
        GeneFactory(label="gene3", entrez_id=3),
    ]
    cell_lines = [
        CellLineFactory(depmap_id="ACH-1", cell_line_display_name="cell_line1"),
        CellLineFactory(depmap_id="ACH-2", cell_line_display_name="cell_line2"),
        CellLineFactory(depmap_id="ACH-3", cell_line_display_name="cell_line3"),
    ]
    crispr_dataset = DependencyDatasetFactory(
        matrix=MatrixFactory(
            entities=genes,
            cell_lines=cell_lines,
            data=[[1.0, 10.0, 100.0], [2.0, 20.0, 200.0], [3.0, 30.0, 300.0]],
        ),
        name=DependencyEnum.Chronos_Combined,
        priority=1,
    )

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    # Test: Get the gene with the entrez id "2"
    basic_context_request = {
        "context": {
            "dimension_type": "gene",
            "name": "gene 2",
            "expr": {"==": [{"var": "given_id"}, "2"]},
        },
    }

    with app.test_client() as c:
        r = c.post(
            url_for("data_explorer_2.get_v2_context_summary"),
            data=json.dumps(basic_context_request),
            content_type="application/json",
        )
        assert r.status_code == 200, r.status_code
        # returns a compressed response, which needs to be unzipped
        response = r.json

        assert response["num_candidates"] == 3
        assert response["num_matches"] == 1

    # Test: Get all genes except for the ones in the given set
    basic_context_request = {
        "context": {
            "dimension_type": "gene",
            "name": "all genes excluding a couple",
            "expr": {"!in": [{"var": "given_id"}, ["2", "4"]]},
        },
    }

    with app.test_client() as c:
        r = c.post(
            url_for("data_explorer_2.get_v2_context_summary"),
            data=json.dumps(basic_context_request),
            content_type="application/json",
        )
        assert r.status_code == 200, r.status_code
        # returns a compressed response, which needs to be unzipped
        response = r.json

        assert response["num_candidates"] == 3
        assert response["num_matches"] == 2

    # Test: Get all models with ids in given set
    basic_context_request = {
        "context": {
            "dimension_type": "depmap_model",
            "name": "subset of models",
            "expr": {"in": [{"var": "given_id"}, ["ACH-1"]]},
        },
    }

    with app.test_client() as c:
        r = c.post(
            url_for("data_explorer_2.get_v2_context_summary"),
            data=json.dumps(basic_context_request),
            content_type="application/json",
        )
        assert r.status_code == 200, r.status_code
        # returns a compressed response, which needs to be unzipped
        response = r.json

        assert response["num_candidates"] == 3
        assert response["num_matches"] == 1


def test_get_v2_context_summary_slice_queries(app, empty_db_mock_downloads):
    """
    Test the evaluation of v2 contexts with slice query expressions. 
    """

    genes = [
        GeneFactory(label="gene1", entrez_id=1),
        GeneFactory(label="gene2", entrez_id=2),
        GeneFactory(label="gene3", entrez_id=3),
    ]
    cell_lines = [
        CellLineFactory(depmap_id="ACH-1", cell_line_display_name="cell_line1"),
        CellLineFactory(depmap_id="ACH-2", cell_line_display_name="cell_line2"),
        CellLineFactory(depmap_id="ACH-3", cell_line_display_name="cell_line3"),
    ]
    dataset_name = DependencyEnum.Chronos_Combined
    dataset_id = dataset_name.name
    crispr_dataset = DependencyDatasetFactory(
        matrix=MatrixFactory(
            entities=genes,
            cell_lines=cell_lines,
            data=[[1.0, 0.1, 0.01], [2.0, 0.2, 0.02], [3.0, 0.3, 0.03]],
        ),
        name=dataset_name,
        priority=1,
    )

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    # Test: Get genes which have a dependency > .15 in the model ACH-3
    basic_context_request = {
        "context": {
            "dimension_type": "gene",
            "name": "dependency greater than",
            "expr": {">": [{"var": "model1_var"}, 0.15]},
            "vars": {
                "model1_var": {
                    "dataset_id": dataset_id,
                    "identifier": "ACH-2",
                    "identifier_type": "sample_id",
                }
            },
        },
    }

    with app.test_client() as c:
        r = c.post(
            url_for("data_explorer_2.get_v2_context_summary"),
            data=json.dumps(basic_context_request),
            content_type="application/json",
        )
        assert r.status_code == 200, r.status_code
        # returns a compressed response, which needs to be unzipped
        response = r.json

        assert response["num_candidates"] == 3
        assert response["num_matches"] == 2

    # Test: Get models which have a dependency of < .5 on gene1
    basic_context_request = {
        "context": {
            "dimension_type": "depmap_model",
            "name": "dependency greater than",
            "expr": {"<": [{"var": "gene_var"}, 0.5]},
            "vars": {
                "gene_var": {
                    "dataset_id": dataset_id,
                    "identifier": "gene2",
                    "identifier_type": "feature_label",
                }
            },
        },
    }

    with app.test_client() as c:
        r = c.post(
            url_for("data_explorer_2.get_v2_context_summary"),
            data=json.dumps(basic_context_request),
            content_type="application/json",
        )
        assert r.status_code == 200, r.status_code
        # returns a compressed response, which needs to be unzipped
        response = r.json

        assert response["num_candidates"] == 3
        assert response["num_matches"] == 2
