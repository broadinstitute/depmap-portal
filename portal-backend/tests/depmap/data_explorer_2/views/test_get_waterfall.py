import json

from flask import url_for
import gzip

from tests.factories import (
    CellLineFactory,
    DependencyDatasetFactory,
    GeneFactory,
    MatrixFactory,
)
from depmap.enums import DependencyEnum
from tests.utilities import interactive_test_utils


def test_get_waterfall_model_index(app, empty_db_mock_downloads):
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
            data=[[1.0, 2.0], [5.0, 4.0]],
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
            url_for("data_explorer_2.get_waterfall"),
            data=json.dumps(plot_config_request),
            content_type="application/json",
        )
        assert r.status_code == 200, r.status_code
        # plot dimensions returns a compressed response, which needs to be unzipped
        response = json.loads(gzip.decompress(r.data).decode("utf8"))

        assert response["filters"] == {}
        assert response["index_type"] == "depmap_model"
        assert response["metadata"] == {}
        assert response["index_labels"] == ["ACH-1", "ACH-0"]
        assert len(response["index_aliases"]) == 1
        assert response["index_aliases"][0]["label"] == "Cell Line Name"
        assert (
            response["index_aliases"][0]["slice_id"]
            == "slice/cell_line_display_name/all/label"
        )
        assert response["index_aliases"][0]["values"] == [
            cell_line1.cell_line_display_name,
            cell_line0.cell_line_display_name,
        ]

        # NOTE: This behavior is potentially unexpected, but it IS intentional. We've requested 1 "x" dimension,
        # and we get back BOTH an "x" and "y", with the actual values for the dataset returned
        # as y values. This is expected. "x" is required, because for waterfall plots, x is plotted
        # as the index of each value "y", when "y" is sorted ascending.
        assert set(response["dimensions"].keys()) == set(["x", "y"])
        assert gene1.label in response["dimensions"]["y"]["axis_label"]
        assert response["dimensions"]["y"]["dataset_id"] == crispr_dataset.name.name
        assert response["dimensions"]["y"]["dataset_label"] is not None
        assert response["dimensions"]["y"]["entity_type"] == "gene"

        # Make sure the y values are in ascending order. The request listed them as 5.0, 4.0.
        # Here, the order should be asc.
        assert response["dimensions"]["y"]["values"] == [
            4.0,
            5.0,
        ]

        # The get_waterfall endpoint returns a rank for x. This is just the index for each
        # y value.
        assert response["dimensions"]["x"]["values"] == [
            0,
            1,
        ]

        # Set the x dimension dataset_label to an empty string to avoid printing "null"
        # when the user downloads a csv.
        assert response["dimensions"]["x"]["dataset_label"] == ""


def test_get_waterfall_bad_request(app, empty_db_mock_downloads):
    gene0 = GeneFactory(label="gene0")
    gene1 = GeneFactory(label="gene1")
    cell_line0 = CellLineFactory(depmap_id="ACH-0")
    cell_line1 = CellLineFactory(depmap_id="ACH-1")
    crispr_dataset = DependencyDatasetFactory(
        matrix=MatrixFactory(
            entities=[gene0, gene1],
            cell_lines=[cell_line0, cell_line1],
            data=[[1.0, 2.0], [5.0, 4.0]],
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
                    "name": "NON_EXISTANT_LABEL",
                    "context_type": "gene",
                    "expr": {"==": [{"var": "entity_label"}, "NON_EXISTANT_LABEL"]},
                },
            }
        },
    }

    with app.test_client() as c:
        r = c.post(
            url_for("data_explorer_2.get_waterfall"),
            data=json.dumps(plot_config_request),
            content_type="application/json",
        )

        assert r.status_code == 400


def test_get_waterfall_gene_index(app, empty_db_mock_downloads):
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
            data=[[5.0, 2.0], [3.0, 4.0]],
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
            url_for("data_explorer_2.get_waterfall"),
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
        # The order of the gene index labels must match the sort ascending of the y axis values.
        assert response["index_labels"] == [gene1.label, gene0.label]
        assert len(response["index_aliases"]) == 0  # genes don't need aliases

        # NOTE: This behavior is potentially unexpected, but it IS intentional.
        # We've requested 1 "x" dimension, and we get back BOTH an "x" and "y", with
        # the actual values for the dataset returned as y values. This is expected. "x"
        # is required, because for waterfall plots, x is plotted
        # as the index of each value "y", when "y" is sorted ascending.
        assert set(response["dimensions"].keys()) == set(["x", "y"])
        assert cell_line0.depmap_id in response["dimensions"]["y"]["axis_label"]
        assert response["dimensions"]["y"]["dataset_id"] == crispr_dataset.name.name
        assert response["dimensions"]["y"]["dataset_label"] is not None
        assert response["dimensions"]["y"]["entity_type"] == "depmap_model"
        assert response["dimensions"]["y"]["values"] == [3.0, 5.0]

        assert response["dimensions"]["x"]["axis_label"] == "Rank"
        assert response["dimensions"]["x"]["dataset_label"] == ""
