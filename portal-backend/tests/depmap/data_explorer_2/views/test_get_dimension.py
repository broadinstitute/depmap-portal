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


def test_get_dimension_single_row(app, empty_db_mock_downloads):
    """
    Recreating a bug which was occuring with single-row datasets.
    """
    gene0 = GeneFactory(label="gene0")
    gene1 = GeneFactory(label="gene1")
    cell_line0 = CellLineFactory(
        depmap_id="ACH-0", cell_line_display_name="cell_line_0"
    )
    crispr_dataset = DependencyDatasetFactory(
        matrix=MatrixFactory(
            entities=[gene0, gene1], cell_lines=[cell_line0], data=[[1.0], [2.0]],
        ),
        name=DependencyEnum.Chronos_Combined,
        priority=1,
    )

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    get_dimension_model_request = {
        "index_type": "depmap_model",
        "dimension": {
            "axis_type": "entity",
            "aggregation": "first",
            "context": {
                "context_type": "Canary dataset local Feature",
                "name": "gene0",
                "expr": {"==": [{"var": "entity_label"}, "gene0"]},
            },
            "dataset_id": "Chronos_Combined",
            "entity_type": "Test dataset local Feature",
        },
    }
    get_dimension_gene_request = {
        "index_type": "gene",
        "dimension": {
            "axis_type": "entity",
            "aggregation": "first",
            "context": {
                "context_type": "Canary dataset local Feature",
                "name": "ACH-0",
                "expr": {"==": [{"var": "entity_label"}, "ACH-0"]},
            },
            "dataset_id": "Chronos_Combined",
            "entity_type": "Test dataset local Feature",
        },
    }

    with app.test_client() as c:
        # Get the single model value belonging to gene0
        r = c.post(
            url_for("data_explorer_2.get_dimension"),
            data=json.dumps(get_dimension_model_request),
            content_type="application/json",
        )
        assert r.status_code == 200, r.status_code
        # get dimension returns a compressed response, which needs to be unzipped
        response = json.loads(gzip.decompress(r.data).decode("utf8"))

        assert response["axis_label"] == "gene0 units"
        assert response["dataset_id"] == "Chronos_Combined"
        assert response["dataset_label"] == "Chronos_Combined display name"
        assert response["entity_type"] == "Test dataset local Feature"
        assert response["indexed_values"] == {"ACH-0": 1.0}

        # Get the two gene values associated with the one model
        r = c.post(
            url_for("data_explorer_2.get_dimension"),
            data=json.dumps(get_dimension_gene_request),
            content_type="application/json",
        )
        assert r.status_code == 200, r.status_code
        # get dimension returns a compressed response, which needs to be unzipped
        response = json.loads(gzip.decompress(r.data).decode("utf8"))

        assert response["axis_label"] == "cell_line_0 (ACH-0) units"
        assert response["dataset_id"] == "Chronos_Combined"
        assert response["dataset_label"] == "Chronos_Combined display name"
        assert response["entity_type"] == "Test dataset local Feature"
        assert response["indexed_values"] == {"gene0": 1.0, "gene1": 2.0}
