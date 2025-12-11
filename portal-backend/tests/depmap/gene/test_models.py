from depmap.gene.models import (
    Gene,
    get_stable_id_type,
    GeneExecutiveInfo,
    GeneScoreConfidence,
)
from tests.factories import (
    GeneFactory,
    EntityAliasFactory,
    CompoundFactory,
    GeneScoreConfidenceFactory,
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


@pytest.mark.parametrize(
    "stable_id, expected", [("1234", "entrez_id"), ("ENSG00000213281", "ensembl_id")]
)
def test_get_stable_id_type(stable_id, expected):
    """
    Test that the stable id type is correctly identified
    """
    assert get_stable_id_type(stable_id) == expected


def test_get_all_confidence_evidence_scores(empty_db_mock_downloads):
    GeneScoreConfidenceFactory.create_batch(5)
    # this needs to be a commit and not just a flush because the tested function uses pd.read_sqli
    empty_db_mock_downloads.session.commit()
    df = GeneScoreConfidence.get_all_genes_confidence_evidence()
    expected_columns = [
        "guide_consistency_mean",
        "guide_consistency_max",
        "unique_guides",
        "sanger_crispr_consistency",
        "rnai_consistency",
        "normLRT",
        "predictability",
        "top_feature_importance",
        "top_feature_confounder",
    ]
    assert set(df.columns) == set(expected_columns)
    assert len(df) == 5
