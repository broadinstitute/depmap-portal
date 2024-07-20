import json
import gzip

from flask import url_for
from unittest.mock import MagicMock

from depmap.dataset.models import BiomarkerDataset
from depmap.enums import DependencyEnum

from tests.factories import (
    GeneFactory,
    MatrixFactory,
    BiomarkerDatasetFactory,
    DependencyDatasetFactory,
    CellLineFactory,
)
from tests.utilities import interactive_test_utils


def test_datasets_matching_context(app, empty_db_mock_downloads, mock_breadbox_client):
    """
    Test that it can identify which two of three datasets 
    match the given context.
    """
    gene0 = GeneFactory(label="gene0")
    gene1 = GeneFactory(label="gene1")
    gene2 = GeneFactory(label="gene2")
    gene3 = GeneFactory(label="gene3")
    cell_line0 = CellLineFactory(depmap_id="ACH-0")
    cell_line1 = CellLineFactory(depmap_id="ACH-1")
    cell_line2 = CellLineFactory(depmap_id="ACH-2")
    crispr_dataset = DependencyDatasetFactory(
        matrix=MatrixFactory(
            entities=[gene0, gene1],
            cell_lines=[cell_line0, cell_line1],
            data=[[1.0, 2.0], [3.0, 4.0]],
        ),
        name=DependencyEnum.Chronos_Combined,
        priority=1,
    )
    expression_dataset = BiomarkerDatasetFactory(
        name=BiomarkerDataset.BiomarkerEnum.expression,
        matrix=MatrixFactory(
            entities=[gene1, gene2],
            cell_lines=[cell_line0, cell_line1, cell_line2],
            data=[[1.0, 2.0, 3.0], [5.0, 6.0, 7.0]],
        ),
    )
    unrelated_dataset = BiomarkerDatasetFactory(
        name=BiomarkerDataset.BiomarkerEnum.copy_number_absolute,
        matrix=MatrixFactory(
            entities=[gene2, gene3],
            cell_lines=[cell_line0, cell_line1],
            data=[[1.0, 2.0], [5.0, 6.0]],
        ),
    )

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    mock_breadbox_client.get_datasets = MagicMock(return_value=[])

    request_context = {
        "context": {
            "name": gene1.label,
            "context_type": "gene",
            "expr": {"==": [{"var": "entity_label"}, gene1.label]},
        },
    }

    with app.test_client() as c:
        r = c.post(
            url_for("data_explorer_2.datasets_matching_context"),
            data=json.dumps(request_context),
            content_type="application/json",
        )
        assert r.status_code == 200, r.status_code
        response = json.loads(gzip.decompress(r.data))

        # Should return a list with only two datasets
        assert set(response) == {crispr_dataset.name.name, expression_dataset.name.name}
