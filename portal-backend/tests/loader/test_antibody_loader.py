import pytest
import os

from depmap.database import transaction
from loader.antibody_loader import create_antibody_object
from loader.gene_loader import load_hgnc_genes
from depmap.antibody.models import Antibody


@pytest.mark.parametrize(
    "antibody, expected_protein, expected_phos, expected_caution, expected_valida_unavail",
    [
        ("AMPK", "AMPK", None, False, False),
        ("AMP-K", "AMP-K", None, False, False),
        ("AMPK(T172)", "AMPK(T172)", None, False, False),
        ("AMPK_alpha", "AMPK_alpha", None, False, False),
        ("AMPK_alpha_Caution", "AMPK_alpha", None, True, False),
        ("AMPK_pT172", "AMPK", "T172", False, False),
        ("AMPK_pT172_S9", "AMPK", "T172_S9", False, False),
        ("AMPK_S9_pT172", "AMPK_S9", "T172", False, False),
        ("AMPK_pT172_S9_Caution", "AMPK", "T172_S9", True, False),
        ("AMPK_pT172_S9_ValidationUnavailable", "AMPK", "T172_S9", False, True),
        ("AMPK_ValidationUnavailable_Caution", "AMPK", None, True, True),
        ("AMPK_Caution_ValidationUnavailable", "AMPK", None, True, True),
        (
            "Caspase-7_cleavedD198_Caution",
            "Caspase-7_cleavedD198",
            None,
            True,
            False,
        ),  # testing some weird real examples
        ("PKC-pan_BetaII_pS660", "PKC-pan_BetaII", "S660", False, False),
        ("p27_pT198", "p27", "T198", False, False),
        # The first pT27 should not be captured as phos since it is not preceded by an underscore
        ("pT27_pT198", "pT27", "T198", False, False),
    ],
)
def test_create_antibody_object_antibody_parsing(
    app,
    antibody,
    expected_protein,
    expected_phos,
    expected_caution,
    expected_valida_unavail,
):
    """
    Test that the antibody is parsed correctly to the appropriate properties. Mostly testing that the regex works 
    """
    genes = []
    antibody_object = create_antibody_object(antibody, genes)
    assert antibody_object.protein == expected_protein
    assert antibody_object.phosphorylation == expected_phos
    assert antibody_object.is_caution == expected_caution
    assert antibody_object.is_validation_unavailable == expected_valida_unavail


@pytest.mark.parametrize(
    "antibody, expected", [("AMPK", "AMPK"), ("AMPK_pT9", "AMPK_pT9")]
)
def test_create_antibody_object_label(app, antibody, expected):
    """
    Test that the label is correct
    specifically that AMPK doesn't become AMPK_p or AMPK_pNone
    """
    assert create_antibody_object(antibody, []).label == expected


def test_create_antibody_object_genes(empty_db_mock_downloads):
    """
    Test that genes come out correct when:
    All gene names are valid
    Some gene names are valid and allow_missing_entities is True
    Some gene names are valid and allow_missing_entities is False
    """
    with transaction(empty_db_mock_downloads):
        loader_data_dir = empty_db_mock_downloads.app.config["LOADER_DATA_DIR"]
        load_hgnc_genes(os.path.join(loader_data_dir, "gene/hgnc-database-1a29.1.csv"))

        all_valid_genes = {"MAP4K4", "MED1"}
        antibody_object = create_antibody_object("all_valid", all_valid_genes)
        empty_db_mock_downloads.session.add(antibody_object)

        antibody_genes = Antibody.query.filter_by(label="all_valid").one().gene
        assert set(gene.label for gene in antibody_genes) == all_valid_genes

        # test allow_missing_entities True
        some_invalid_gene = {"invalidgene", "MED1"}
        antibody_object = create_antibody_object(
            "some_invalid", some_invalid_gene, allow_missing_entities=True
        )
        empty_db_mock_downloads.session.add(antibody_object)
        antibody_genes = Antibody.query.filter_by(label="some_invalid").one().gene
        assert len(antibody_genes) == 1
        assert antibody_genes[0].label == "MED1"

    with pytest.raises(AssertionError):
        create_antibody_object("ABC", some_invalid_gene)
