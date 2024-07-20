import json

from flask import url_for
import gzip
from unittest.mock import MagicMock

from depmap.enums import DependencyEnum

from tests.factories import (
    GeneFactory,
    MatrixFactory,
    DependencyDatasetFactory,
    CellLineFactory,
)
from tests.utilities import interactive_test_utils


def test_entity_labels(app, empty_db_mock_downloads, mock_breadbox_client):
    """
    Mock datasets with overlapping entities. 
    Check that all unique entity labels are loaded.
    """
    gene0 = GeneFactory(label="gene0")
    gene1 = GeneFactory(label="gene1")
    gene2 = GeneFactory(label="gene2")
    cell_line0 = CellLineFactory(depmap_id="ACH-0")
    cell_line1 = CellLineFactory(depmap_id="ACH-1")
    dataset0 = DependencyDatasetFactory(
        matrix=MatrixFactory(
            entities=[gene0, gene1],
            cell_lines=[cell_line0, cell_line1],
            data=[[1.0, 2.0], [3.0, 4.0]],
        ),
        name=DependencyEnum.Chronos_Combined,
        priority=1,
    )
    dataset1 = DependencyDatasetFactory(
        matrix=MatrixFactory(
            entities=[gene1, gene2],
            cell_lines=[cell_line0, cell_line1],
            data=[[1.0, 2.0], [3.0, 4.0]],
        ),
        name=DependencyEnum.Chronos_Achilles,
        priority=2,
    )
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    mock_breadbox_client.get_datasets = MagicMock(return_value=[])

    with app.test_client() as c:
        r = c.get(
            url_for("data_explorer_2.entity_labels", entity_type="gene"),
            content_type="application/json",
        )
        assert r.status_code == 200, r.status_code
        response = json.loads(gzip.decompress(r.data).decode("utf8"))

        assert response.get("labels") == ["gene0", "gene1", "gene2"]
        assert response.get("aliases") == []
