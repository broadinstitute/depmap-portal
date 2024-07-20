import json

from flask import url_for
import gzip

from depmap.dataset.models import BiomarkerDataset
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


def test_plot_dimensions_1d_model_index(app, empty_db_mock_downloads):
    """
    Minimal example querying model values by gene
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

    with app.test_client() as c:
        r = c.post(
            url_for("data_explorer_2.plot_dimensions"),
            data=json.dumps(plot_config_request),
            content_type="application/json",
        )
        assert r.status_code == 200, r.status_code
        # plot dimensions returns a compressed response, which needs to be unzipped
        response = json.loads(gzip.decompress(r.data).decode("utf8"))

        # validate the response structure
        assert response["filters"] == {}
        assert response["index_type"] == "depmap_model"
        assert response["metadata"] == {}

        # check the cell line indices
        assert response["index_labels"] == ["ACH-0", "ACH-1"]
        assert len(response["index_aliases"]) == 1
        assert response["index_aliases"][0]["label"] == "Cell Line Name"
        assert (
            response["index_aliases"][0]["slice_id"]
            == "slice/cell_line_display_name/all/label"
        )
        assert response["index_aliases"][0]["values"] == [
            cell_line0.cell_line_display_name,
            cell_line1.cell_line_display_name,
        ]

        # Check that the single dimension (x) has expected values
        assert set(response["dimensions"].keys()) == set(["x"])
        assert gene1.label in response["dimensions"]["x"]["axis_label"]
        assert response["dimensions"]["x"]["dataset_id"] == crispr_dataset.name.name
        assert response["dimensions"]["x"]["dataset_label"] is not None
        assert response["dimensions"]["x"]["entity_type"] == "gene"
        assert response["dimensions"]["x"]["values"] == [
            3.0,
            4.0,
        ]


def test_plot_dimensions_1d_gene_index(app, empty_db_mock_downloads):
    """
    Minimal example querying gene values by model
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
        "index_type": "gene",
        "dimensions": {
            "x": {
                "dataset_id": "Chronos_Combined",
                "entity_type": "depmap_model",
                "aggregation": "first",
                "context": {
                    "name": cell_line0.depmap_id,
                    "context_type": "depmap_model",
                    "expr": {"==": [{"var": "entity_label"}, cell_line0.depmap_id]},
                },
            }
        },
    }

    with app.test_client() as c:
        r = c.post(
            url_for("data_explorer_2.plot_dimensions"),
            data=json.dumps(plot_config_request),
            content_type="application/json",
        )
        assert r.status_code == 200, r.status_code
        # plot dimensions returns a compressed response, which needs to be unzipped
        response = json.loads(gzip.decompress(r.data).decode("utf8"))

        # validate the response structure
        assert response["filters"] == {}
        assert response["index_type"] == "gene"
        assert response["metadata"] == {}

        # check the gene indices
        assert response["index_labels"] == [gene0.label, gene1.label]
        assert len(response["index_aliases"]) == 0  # genes don't need aliases

        # Check that the single dimension (x) has expected values
        assert set(response["dimensions"].keys()) == set(["x"])
        assert cell_line0.depmap_id in response["dimensions"]["x"]["axis_label"]
        assert response["dimensions"]["x"]["dataset_id"] == crispr_dataset.name.name
        assert response["dimensions"]["x"]["dataset_label"] is not None
        assert response["dimensions"]["x"]["entity_type"] == "depmap_model"
        assert response["dimensions"]["x"]["values"] == [1.0, 3.0]


def test_plot_dimensions_3d(app, empty_db_mock_downloads):
    """
    Querying for gene values with three dimensions (x, y, and color), use aggregations
    """
    gene0 = GeneFactory(label="gene0")
    gene1 = GeneFactory(label="gene1")

    cell_line0 = CellLineFactory(
        depmap_id="ACH-0", lineage=[LineageFactory(name="Other")]
    )
    cell_line1 = CellLineFactory(
        depmap_id="ACH-1", lineage=[LineageFactory(name="Other")]
    )
    cell_line2 = CellLineFactory(
        depmap_id="ACH-2", lineage=[LineageFactory(name="Breast")]
    )
    cell_line3 = CellLineFactory(
        depmap_id="ACH-3", lineage=[LineageFactory(name="Breast")]
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
    expression_dataset = BiomarkerDatasetFactory(
        name=BiomarkerDataset.BiomarkerEnum.expression,
        matrix=MatrixFactory(
            entities=[gene0, gene1],
            cell_lines=[cell_line0, cell_line1, cell_line2, cell_line3],
            data=[[1.0, 2.0, 3.0, 4.0], [5.0, 6.0, 7.0, 8.0]],
        ),
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
            "y": {
                "dataset_id": "Chronos_Combined",
                "entity_type": "depmap_model",
                "aggregation": "mean",
                "context": {
                    "name": "Not Breast",
                    "context_type": "depmap_model",
                    "expr": {"!": {"==": [{"var": "slice/lineage/1/label"}, "Breast"]}},
                },
            },
            "color": {
                "dataset_id": "expression",
                "entity_type": "depmap_model",
                "aggregation": "first",
                "context": {
                    "name": cell_line1.depmap_id,
                    "context_type": "depmap_model",
                    "expr": {"==": [{"var": "entity_label"}, cell_line1.depmap_id]},
                },
            },
        },
    }

    with app.test_client() as c:
        r = c.post(
            url_for("data_explorer_2.plot_dimensions"),
            data=json.dumps(plot_config_request),
            content_type="application/json",
        )
        assert r.status_code == 200, r.status_code
        # plot dimensions returns a compressed response, which needs to be unzipped
        response = json.loads(gzip.decompress(r.data).decode("utf8"))

        # validate the response structure
        assert response["filters"] == {}
        assert response["index_type"] == "gene"
        assert response["metadata"] == {}

        # check the gene indices
        assert response["index_labels"] == [gene0.label, gene1.label]
        assert len(response["index_aliases"]) == 0  # genes don't need aliases

        # Check that each dimension has expected values
        assert set(response["dimensions"].keys()) == set(["x", "y", "color"])

        assert "Breast" in response["dimensions"]["x"]["axis_label"]
        assert response["dimensions"]["x"]["dataset_id"] == crispr_dataset.name.name
        assert response["dimensions"]["x"]["dataset_label"] is not None
        assert response["dimensions"]["x"]["entity_type"] == "depmap_model"
        assert response["dimensions"]["x"]["values"] == [
            (3 + 4) / 2.0,
            (7 + 8) / 2.0,
        ]  # average of the breast lineage values

        assert "Not Breast" in response["dimensions"]["y"]["axis_label"]
        assert response["dimensions"]["y"]["dataset_id"] == crispr_dataset.name.name
        assert response["dimensions"]["y"]["dataset_label"] is not None
        assert response["dimensions"]["y"]["entity_type"] == "depmap_model"
        assert response["dimensions"]["y"]["values"] == [
            (1 + 2) / 2.0,
            (5 + 6) / 2.0,
        ]  # average of the non-breast lineage values

        assert cell_line1.depmap_id in response["dimensions"]["color"]["axis_label"]
        assert (
            response["dimensions"]["color"]["dataset_id"]
            == expression_dataset.name.name
        )
        assert response["dimensions"]["color"]["dataset_label"] is not None
        assert response["dimensions"]["color"]["entity_type"] == "depmap_model"
        assert response["dimensions"]["color"]["values"] == [2.0, 6.0]
