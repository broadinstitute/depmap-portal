import json

from flask import url_for
import gzip

from depmap.enums import DependencyEnum

from tests.factories import (
    GeneFactory,
    MatrixFactory,
    BiomarkerDatasetFactory,
    DependencyDatasetFactory,
    CellLineFactory,
    LineageFactory,
)
from tests.utilities import interactive_test_utils


def test_evaluate_v2_context_given_id_match(app, empty_db_mock_downloads):
    """
    Test the evaluation of v2 contexts with expressions 
    that use the special 'given_id' variable. 
    """
    gene0 = GeneFactory(label="gene0")
    gene1 = GeneFactory(label="gene1")
    gene2 = GeneFactory(label="gene2")
    cell_lines = CellLineFactory.create_batch(3)
    crispr_dataset = DependencyDatasetFactory(
        matrix=MatrixFactory(
            entities=[gene0, gene1, gene2],
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
            "name": "gene0",
            "expr": {"==": [{"var": "given_id"}, "2"]},
        },
    }

    with app.test_client() as c:
        # Get the single model value belonging to gene0
        r = c.post(
            url_for("data_explorer_2.evaluate_v2_context"),
            data=json.dumps(basic_context_request),
            content_type="application/json",
        )
        assert r.status_code == 200, r.status_code
        # get dimension returns a compressed response, which needs to be unzipped
        response = json.loads(gzip.decompress(r.data).decode("utf8"))

        assert response["ids"] == ["2"]

    # Test: Get all genes except for the ones in the given set
    basic_context_request = {
        "context": {
            "dimension_type": "gene",
            "name": "gene0",
            "expr": {"!in": [{"var": "given_id"}, ["2", "4"]]},
        },
    }

    with app.test_client() as c:
        # Get the single model value belonging to gene0
        r = c.post(
            url_for("data_explorer_2.evaluate_v2_context"),
            data=json.dumps(basic_context_request),
            content_type="application/json",
        )
        assert r.status_code == 200, r.status_code
        # get dimension returns a compressed response, which needs to be unzipped
        response = json.loads(gzip.decompress(r.data).decode("utf8"))

        assert response["ids"] == ["1", "3"]

    # Test: Get all models with ids in given set
    basic_context_request = {
        "context": {
            "dimension_type": "depmap_model",
            "name": "gene0",
            "expr": {"in": [{"var": "given_id"}, ["ACH-0", "ACH-1"]]},
        },
    }

    with app.test_client() as c:
        # Get the single model value belonging to gene0
        r = c.post(
            url_for("data_explorer_2.evaluate_v2_context"),
            data=json.dumps(basic_context_request),
            content_type="application/json",
        )
        assert r.status_code == 200, r.status_code
        # get dimension returns a compressed response, which needs to be unzipped
        response = json.loads(gzip.decompress(r.data).decode("utf8"))

        assert response["ids"] == ["ACH-0", "ACH-1"]


def test_evaluate_v2_context_slice_queries(app, empty_db_mock_downloads):
    """
    Test the evaluation of v2 contexts with slice query expressions. 
    """
    gene0 = GeneFactory(label="gene0")
    gene1 = GeneFactory(label="gene1")
    gene2 = GeneFactory(label="gene2")
    cell_lines = CellLineFactory.create_batch(3)
    crispr_dataset = DependencyDatasetFactory(
        matrix=MatrixFactory(
            entities=[gene0, gene1, gene2],
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
            "name": "gene0",
            "expr": {"==": [{"var": "given_id"}, "2"]},
        },
    }

    with app.test_client() as c:
        # Get the single model value belonging to gene0
        r = c.post(
            url_for("data_explorer_2.evaluate_v2_context"),
            data=json.dumps(basic_context_request),
            content_type="application/json",
        )
        assert r.status_code == 200, r.status_code
        # get dimension returns a compressed response, which needs to be unzipped
        response = json.loads(gzip.decompress(r.data).decode("utf8"))

        assert response["ids"] == ["2"]


# TODO: write test that uses multiple datasets (and combines multiple queries)
