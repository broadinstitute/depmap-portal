import json

from flask import url_for
import gzip

from depmap.enums import DependencyEnum

from tests.factories import (
    GeneFactory,
    MatrixFactory,
    DependencyDatasetFactory,
    CellLineFactory,
    LineageFactory,
)
from tests.utilities import interactive_test_utils


def test_get_correlation_1d(app, empty_db_mock_downloads):
    """
    Minimal example with one dimension and single dataset
    """
    gene0 = GeneFactory(label="gene0")
    gene1 = GeneFactory(label="gene1")
    cell_line0 = CellLineFactory(depmap_id="ACH-0")
    cell_line1 = CellLineFactory(depmap_id="ACH-1")
    crispr_dataset = DependencyDatasetFactory(
        matrix=MatrixFactory(
            entities=[gene0, gene1],
            cell_lines=[cell_line0, cell_line1],
            data=[[1.0, 2.0], [3.0, 4.0]],
        ),
        name=DependencyEnum.Chronos_Combined,
        priority=1,
    )

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    plot_config_request = {
        "index_type": "depmap_model",
        "dimensions": {
            "x": {
                "dataset_id": "Chronos_Combined",
                "entity_type": "gene",
                "aggregation": "first",
                "context": {
                    "name": gene1.label,
                    "context_type": "gene",
                    "expr": {"==": [{"var": "entity_label"}, gene1.label]},
                },
            }
        },
    }

    expected_response = {
        "dimensions": {
            "x": {
                "axis_label": "correlation of 1 gene1 genes",
                "dataset_id": "Chronos_Combined",
                "dataset_label": "Chronos_Combined display name",
                "values": [[1.0]],
            }
        },
        "index_aliases": [],
        "index_labels": ["gene1"],
        "index_type": "depmap_model",
    }

    with app.test_client() as c:
        r = c.post(
            url_for("data_explorer_2.get_correlation"),
            data=json.dumps(plot_config_request),
            content_type="application/json",
        )
        assert r.status_code == 200, r.status_code
        response = json.loads(gzip.decompress(r.data).decode("utf8"))

        # pytest is smart about comparing nested dicts
        assert response == expected_response


def test_get_correlation_2d(app, empty_db_mock_downloads):
    """
    More complicated example with multiple dimenions
    """

    gene0 = GeneFactory(label="gene0")
    gene1 = GeneFactory(label="gene1")
    cell_line0 = CellLineFactory(
        depmap_id="ACH-0",
        cell_line_display_name="Name_0",
        lineage=[LineageFactory(name="Other")],
    )
    cell_line1 = CellLineFactory(
        depmap_id="ACH-1",
        cell_line_display_name="Name_1",
        lineage=[LineageFactory(name="Other")],
    )
    cell_line2 = CellLineFactory(
        depmap_id="ACH-2",
        cell_line_display_name="Name_2",
        lineage=[LineageFactory(name="Breast")],
    )
    cell_line3 = CellLineFactory(
        depmap_id="ACH-3",
        cell_line_display_name="Name_3",
        lineage=[LineageFactory(name="Breast")],
    )
    crispr_dataset = DependencyDatasetFactory(
        matrix=MatrixFactory(
            entities=[gene0, gene1],
            cell_lines=[cell_line0, cell_line1, cell_line2, cell_line3],
            data=[[1.0, 2.0, 3.0, 4.0], [5.0, 6.0, 7.0, 8.0]],
        ),
        name=DependencyEnum.Chronos_Combined,
        priority=1,
    )

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    plot_config_request = {
        "index_type": "gene",
        "dimensions": {
            "x": {
                "dataset_id": "Chronos_Combined",
                "entity_type": "depmap_model",
                "aggregation": "mean",
                "context": {
                    "name": "Breast",
                    "context_type": "depmap_model",
                    "expr": {"==": [{"var": "slice/lineage/1/label"}, "Breast"]},
                },
            },
            "x2": {
                "dataset_id": "Chronos_Combined",
                "entity_type": "depmap_model",
                "aggregation": "mean",
                "context": {
                    "name": "Not Breast",
                    "context_type": "depmap_model",
                    "expr": {"!": {"==": [{"var": "slice/lineage/1/label"}, "Breast"]}},
                },
            },
        },
    }

    expected_response = {
        "dimensions": {
            "x": {
                "axis_label": "correlation of 2 Breast models",
                "dataset_id": "Chronos_Combined",
                "dataset_label": "Chronos_Combined display name",
                "values": [[1.0, 1.0], [1.0, 1.0]],
            }
        },
        "index_aliases": [
            {
                "label": "Cell Line Name",
                "slice_id": "slice/cell_line_display_name/all/label",
                "values": ["Name_2", "Name_3"],
            }
        ],
        "index_labels": ["ACH-2", "ACH-3"],
        "index_type": "gene",
    }

    with app.test_client() as c:
        r = c.post(
            url_for("data_explorer_2.get_correlation"),
            data=json.dumps(plot_config_request),
            content_type="application/json",
        )
        assert r.status_code == 200, r.status_code
        response = json.loads(gzip.decompress(r.data).decode("utf8"))

        # pytest is smart about comparing nested dicts
        assert response == expected_response
