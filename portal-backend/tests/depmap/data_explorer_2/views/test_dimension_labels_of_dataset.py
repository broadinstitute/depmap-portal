import json

from flask import url_for
import gzip

from depmap.enums import DependencyEnum

from tests.factories import (
    GeneFactory,
    MatrixFactory,
    DependencyDatasetFactory,
    CellLineFactory,
)
from tests.utilities import interactive_test_utils


def test_dimension_labels_of_dataset(app, empty_db_mock_downloads):
    """
    Mock datasets with overlapping entities. 
    Check that all dimension labels are loaded for the given dataset
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

    with app.test_client() as c:
        r = c.get(
            url_for(
                "data_explorer_2.dimension_labels_of_dataset",
                dimension_type="gene",
                dataset_id=DependencyEnum.Chronos_Achilles.name,
            ),
            content_type="application/json",
        )
        assert r.status_code == 200, r.status_code
        response = json.loads(gzip.decompress(r.data).decode("utf8"))

        assert response.get("labels") == ["gene1", "gene2"]
        assert response.get("aliases") == []
