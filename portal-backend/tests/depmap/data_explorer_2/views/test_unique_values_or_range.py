import json

from flask import url_for
import gzip

from depmap.enums import DependencyEnum
from depmap.vector_catalog.models import SliceRowType, SliceSerializer

from tests.factories import (
    DepmapModelFactory,
    GeneFactory,
    MatrixFactory,
    DependencyDatasetFactory,
    CellLineFactory,
    GeneExecutiveInfoFactory,
    MutationFactory,
)
from tests.utilities import interactive_test_utils


def test_categorical_unique_values(app, empty_db_mock_downloads):
    """
    Test that categorical datasets are handled correctly. 
    """
    # Mock gene essentiallity, which will be used as the categorical dataset
    GeneExecutiveInfoFactory(gene=GeneFactory(), is_common_essential=True)
    GeneExecutiveInfoFactory(gene=GeneFactory(), is_common_essential=False)

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    with app.test_client() as c:
        slice_id = "slice/gene_essentiality/all/label"
        r = c.get(
            url_for("data_explorer_2.unique_values_or_range", slice_id=slice_id),
            content_type="application/json",
        )

        assert r.status_code == 200, r.status_code
        response = json.loads(gzip.decompress(r.data).decode("utf8"))

        assert response.get("value_type") == "categorical"
        assert len(response.get("unique_values")) == 2


def test_continuous_range(app, empty_db_mock_downloads):
    """
    Test that the correct range is loaded for a simple continuous dataset.
    """
    gene0 = GeneFactory(label="gene0")
    gene1 = GeneFactory(label="gene1")
    cell_line0 = CellLineFactory(depmap_id="ACH-0")
    cell_line1 = CellLineFactory(depmap_id="ACH-1")
    DependencyDatasetFactory(
        matrix=MatrixFactory(
            entities=[gene0, gene1],
            cell_lines=[cell_line0, cell_line1],
            data=[[1.0, 2.0], [3.0, 4.0]],
        ),
        name=DependencyEnum.Chronos_Combined,
    )

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    with app.test_client() as c:
        slice_id = SliceSerializer.encode_slice_id(
            dataset=DependencyEnum.Chronos_Combined.name,
            feature="gene0",
            slice_row_type=SliceRowType.label,
        )
        r = c.get(
            url_for("data_explorer_2.unique_values_or_range", slice_id=slice_id,),
            content_type="application/json",
        )

        assert r.status_code == 200, r.status_code
        response = json.loads(gzip.decompress(r.data).decode("utf8"))

        assert response.get("value_type") == "continuous"
        assert response.get("min") == 1.0
        assert response.get("max") == 2.0


def test_continuous_range_for_transposed_feature(app, empty_db_mock_downloads):
    """
    Test that the correct range is loaded when the slice id is for a cell line.
    """
    gene0 = GeneFactory(label="gene0")
    gene1 = GeneFactory(label="gene1")
    cell_line0 = CellLineFactory(depmap_id="ACH-0")
    cell_line1 = CellLineFactory(depmap_id="ACH-1")
    DependencyDatasetFactory(
        matrix=MatrixFactory(
            entities=[gene0, gene1],
            cell_lines=[cell_line0, cell_line1],
            data=[[1.0, 2.0], [3.0, 4.0]],
        ),
        name=DependencyEnum.Chronos_Combined,
    )

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    with app.test_client() as c:
        slice_id = f"slice/{DependencyEnum.Chronos_Combined.name}/ACH-0/transpose_label"
        r = c.get(
            url_for("data_explorer_2.unique_values_or_range", slice_id=slice_id,),
            content_type="application/json",
        )

        assert r.status_code == 200, r.status_code
        response = json.loads(gzip.decompress(r.data).decode("utf8"))

        assert response.get("value_type") == "continuous"
        assert response.get("min") == 1.0
        assert response.get("max") == 3.0


def test_mutation_protein_change(app, empty_db_mock_downloads):
    """
    Test that the mutation_protein_change slice_id returns a unique list of protein_changes
    ordered by their frequency of occurence within a particular gene.
    """
    gene0 = GeneFactory(label="gene0")

    model0 = DepmapModelFactory(model_id="ACH-0")
    model1 = DepmapModelFactory(model_id="ACH-1",)
    model2 = DepmapModelFactory(model_id="ACH-2",)

    cell_line0 = model0.cell_line
    cell_line1 = model1.cell_line
    cell_line2 = model2.cell_line

    mutation1 = MutationFactory(gene=gene0, cell_line=cell_line0, protein_change="p.A")
    mutation2 = MutationFactory(gene=gene0, cell_line=cell_line1, protein_change="p.A")
    mutation3 = MutationFactory(gene=gene0, cell_line=cell_line1, protein_change="p.B")
    mutation4 = MutationFactory(gene=gene0, cell_line=cell_line1, protein_change="p.B")
    mutation5 = MutationFactory(gene=gene0, cell_line=cell_line2, protein_change="p.B")
    mutation6 = MutationFactory(gene=gene0, cell_line=cell_line2, protein_change="p.C")

    # Make sure an empty string isn't added to the list of protein_change values
    mutation7 = MutationFactory(gene=gene0, cell_line=cell_line2, protein_change="")
    mutation8 = MutationFactory(gene=gene0, cell_line=cell_line2, protein_change=None)

    expected_unique_values_list = ["p.B", "p.A", "p.C"]

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    with app.test_client() as c:
        slice_id = "slice/mutation_protein_change_by_gene/gene0/label"
        r = c.get(
            url_for("data_explorer_2.unique_values_or_range", slice_id=slice_id,),
            content_type="application/json",
        )

        assert r.status_code == 200, r.status_code
        response = json.loads(gzip.decompress(r.data).decode("utf8"))
        assert response == {
            "unique_values": expected_unique_values_list,
            "value_type": "list_strings",
        }
