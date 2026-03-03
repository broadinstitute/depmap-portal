from depmap.gene.models import Gene
from tests.factories import (
    GeneFactory,
    EntityAliasFactory,
    CompoundFactory,
)
import pytest


@pytest.mark.parametrize(
    "rowname_1, rowname_2, equal",
    [
        ("NRAS (4893)", "NRAS (ENSG00000213281)", True),
        ("TENC1 (23371)", "TNS2 (ENSG00000111077)", True),
        # NRAS with the incorrect entrez id
        ("NRAS (23371)", "NRAS (ENSG00000213281)", False),
    ],
)
def test_get_gene_from_rowname(populated_db, rowname_1, rowname_2, equal):
    """
    Test that get_gene gets the correct gene
    """
    gene_1 = Gene.get_gene_from_rowname(rowname_1)
    gene_2 = Gene.get_gene_from_rowname(rowname_2)
    assert type(gene_1) is Gene and type(gene_2) is Gene

    if equal:
        assert gene_1 == gene_2
    else:
        assert gene_1 != gene_2
