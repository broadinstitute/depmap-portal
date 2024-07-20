from depmap.data_explorer_2.utils import get_series_from_de2_slice_id
import pandas as pd
from depmap.enums import DependencyEnum

from tests.factories import (
    GeneExecutiveInfoFactory,
    GeneFactory,
    MatrixFactory,
    DependencyDatasetFactory,
    DepmapModelFactory,
    MutationFactory,
)


def test_get_series_from_de2_slice_id_special_cases(empty_db_mock_downloads):
    gene0 = GeneFactory(label="gene0")
    gene1 = GeneFactory(label="gene1")
    gene2 = GeneFactory(label="gene2")

    model0 = DepmapModelFactory(
        model_id="ACH-0", stripped_cell_line_name="cell_line_0", age_category="adult"
    )
    model1 = DepmapModelFactory(
        model_id="ACH-1",
        stripped_cell_line_name="cell_line_1",
        age_category="pediatric",
    )
    model2 = DepmapModelFactory(
        model_id="ACH-2",
        stripped_cell_line_name="cell_line_2",
        age_category="pediatric",
    )

    cell_line0 = model0.cell_line
    cell_line1 = model1.cell_line
    cell_line2 = model2.cell_line

    crispr_dataset = DependencyDatasetFactory(
        matrix=MatrixFactory(
            entities=[gene0, gene1],
            cell_lines=[cell_line0, cell_line1],
            data=[[1.0, 2.0], [3.0, 4.0]],
        ),
        name=DependencyEnum.Chronos_Combined,
        priority=1,
    )
    GeneExecutiveInfoFactory(
        gene=gene1, dataset=DependencyEnum.Chronos_Combined,
    )
    GeneExecutiveInfoFactory(
        gene=gene2, dataset=DependencyEnum.Chronos_Combined, is_strongly_selective=True,
    )
    cell_line_display_names = get_series_from_de2_slice_id(
        "slice/cell_line_display_name/all/label"
    )

    assert cell_line_display_names.equals(
        pd.Series(
            index=["ACH-0", "ACH-1", "ACH-2"],
            data=["cell_line_0", "cell_line_1", "cell_line_2"],
        )
    )

    gene_essentiality = get_series_from_de2_slice_id(
        "slice/gene_essentiality/all/label"
    )

    assert gene_essentiality.equals(
        pd.Series(
            index=["gene1", "gene2"],
            data=["not common essential", "not common essential"],
        )
    )

    gene_selectivity = get_series_from_de2_slice_id("slice/gene_selectivity/all/label")
    assert gene_selectivity.equals(
        pd.Series(
            index=["gene1", "gene2"],
            data=["not strongly selective", "strongly selective"],
        )
    )

    mutation1 = MutationFactory(
        gene=gene0, cell_line=cell_line0, protein_change="p.R177W"
    )
    mutation2 = MutationFactory(gene=gene1, cell_line=cell_line1, protein_change="p.A")
    mutation3 = MutationFactory(gene=gene2, cell_line=cell_line1, protein_change="p.B")
    mutation4 = MutationFactory(gene=gene2, cell_line=cell_line1, protein_change="p.C")
    mutation5 = MutationFactory(gene=gene2, cell_line=cell_line2, protein_change="p.B")

    # Make sure an empty string isn't added to the list of protein_change values
    mutation6 = MutationFactory(gene=gene2, cell_line=cell_line2, protein_change="")
    mutation7 = MutationFactory(gene=gene2, cell_line=cell_line2, protein_change=None)

    mutation_protein_change = get_series_from_de2_slice_id(
        "slice/mutation_protein_change_by_gene/gene0/label"
    )

    assert mutation_protein_change.equals(
        pd.Series(index=["ACH-0"], data=[["p.R177W"]],)
    )

    mutation_protein_change = get_series_from_de2_slice_id(
        "slice/mutation_protein_change_by_gene/gene1/label"
    )

    assert mutation_protein_change.equals(pd.Series(index=["ACH-1"], data=[["p.A"]],))

    mutation_protein_change = get_series_from_de2_slice_id(
        "slice/mutation_protein_change_by_gene/gene2/label"
    )

    assert mutation_protein_change.equals(
        pd.Series(index=["ACH-1", "ACH-2"], data=[["p.B", "p.C"], ["p.B"]],)
    )

    age_category = get_series_from_de2_slice_id("slice/age_category/all/label")

    assert age_category.equals(
        pd.Series(
            index=["ACH-0", "ACH-1", "ACH-2"], data=["adult", "pediatric", "pediatric"],
        )
    )
