from depmap.gene.models import Gene
from depmap.antibody.models import Antibody
from depmap.database import transaction


def test_get_from_gene_symbol_gene_id(empty_db_mock_downloads):
    """
    Test Antibody.get_from_gene_symbol and Antibody.get_from_gene_id return the correct antibodies
    """
    gene1 = Gene(
        entity_alias=[],
        label="GENE1",
        name="Gene 1",
        description="",
        entrez_id=0,
        ensembl_id="ENSG0",
        hgnc_id="HGNC:0",
        locus_type="fake locus",
    )
    gene2 = Gene(
        entity_alias=[],
        label="GENE2",
        name="Gene 1",
        description="",
        entrez_id=1,
        ensembl_id="ENSG1",
        hgnc_id="HGNC:1",
        locus_type="fake locus",
    )
    antibody1 = Antibody(
        label="anti1",
        protein="a",
        phosphorylation=None,
        gene=[gene1, gene2],
        is_caution=False,
        is_validation_unavailable=False,
    )
    antibody2 = Antibody(
        label="anti2",
        protein="a",
        phosphorylation=None,
        gene=[gene1],
        is_caution=False,
        is_validation_unavailable=False,
    )
    with transaction(empty_db_mock_downloads):
        empty_db_mock_downloads.session.add(antibody1)
        empty_db_mock_downloads.session.add(antibody2)

    assert set(Antibody.get_from_gene_symbol("GENE1")) == {antibody1, antibody2}
    assert set(Antibody.get_from_gene_symbol("GENE2")) == {antibody1}

    assert set(Antibody.get_from_gene_id(gene1.entity_id)) == {antibody1, antibody2}
    assert set(Antibody.get_from_gene_id(gene2.entity_id)) == {antibody1}
