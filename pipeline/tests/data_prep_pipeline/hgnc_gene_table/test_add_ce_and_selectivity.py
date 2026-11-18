import numpy as np
import pandas as pd
import pytest

from conftest import load_script

mod = load_script(
    "data-prep-pipeline/scripts/hgnc_gene_table/add_ce_and_selectivity.py"
)


def _hgnc(entrez_ids):
    return pd.DataFrame(
        {"symbol": [f"G{i}" for i in range(len(entrez_ids))], "entrez_id": entrez_ids}
    )


def test_add_essentiality_to_hgnc():
    gene_effect = pd.DataFrame(np.zeros((3, 3)), columns=["A (1)", "B (2)", "C (3)"])
    common_essentials = pd.DataFrame({"Essentials": ["A (1)"]})
    # 4 is not in the gene effect matrix, and the entrez_id is missing for the last row
    hgnc = _hgnc([1.0, 2.0, 4.0, np.nan])

    result = mod.add_essentiality_to_hgnc(hgnc, common_essentials, gene_effect)

    assert result["essentiality"].iloc[0] == "common essential"
    assert result["essentiality"].iloc[1] == "not common essential"
    assert pd.isnull(result["essentiality"].iloc[2])
    assert pd.isnull(result["essentiality"].iloc[3])
    # input is not modified
    assert "essentiality" not in hgnc.columns


def test_add_essentiality_to_hgnc_rejects_essential_missing_from_gene_effect():
    gene_effect = pd.DataFrame(np.zeros((3, 1)), columns=["A (1)"])
    common_essentials = pd.DataFrame({"Essentials": ["Z (99)"]})

    with pytest.raises(ValueError):
        mod.add_essentiality_to_hgnc(_hgnc([1]), common_essentials, gene_effect)


def test_add_selectivity_to_hgnc():
    n = 20
    # strongly selective: mostly neutral with a couple of very negative lines
    # (negative skew, high kurtosis) and some lines called dependent
    selective = np.zeros(n)
    selective[:2] = -5
    selective_dep = np.zeros(n)
    selective_dep[:2] = 0.9
    # same shape of effect, but no line is called dependent
    no_dep = selective.copy()
    no_dep_dep = np.zeros(n)
    # symmetric effect distribution => skew of 0
    symmetric = np.linspace(-1, 1, n)
    symmetric_dep = np.zeros(n)
    symmetric_dep[0] = 0.9

    columns = ["A (1)", "B (2)", "C (3)"]
    gene_effect = pd.DataFrame(
        np.column_stack([selective, no_dep, symmetric]), columns=columns
    )
    gene_dependency = pd.DataFrame(
        np.column_stack([selective_dep, no_dep_dep, symmetric_dep]), columns=columns
    )
    hgnc = _hgnc([1.0, 2.0, 3.0, 4.0])

    result = mod.add_selectivity_to_hgnc(hgnc, gene_dependency, gene_effect)

    assert result["selectivity"].iloc[0] == "strongly selective"
    assert result["selectivity"].iloc[1] == "not strongly selective"
    assert result["selectivity"].iloc[2] == "not strongly selective"
    # not in the matrices
    assert pd.isnull(result["selectivity"].iloc[3])


def test_add_selectivity_to_hgnc_rejects_mismatched_matrices():
    gene_effect = pd.DataFrame(np.zeros((3, 2)), columns=["A (1)", "B (2)"])
    gene_dependency = pd.DataFrame(np.zeros((3, 1)), columns=["A (1)"])

    with pytest.raises(ValueError):
        mod.add_selectivity_to_hgnc(_hgnc([1]), gene_dependency, gene_effect)


def test_add_depmap_omics_ensemble_gene_id_to_hgnc():
    # EntrezID is stored as float (as pandas does when a column may hold NaNs)
    omics_map = pd.DataFrame(
        {"EnsemblGeneID": ["ENSG1", "ENSG2", "ENSG3"], "EntrezID": [1.0, 2.0, 3.0]}
    )
    # row order must be preserved, and unmapped/missing entrez_ids get NaN
    hgnc = _hgnc([3.0, 1.0, 2.0, 99.0, np.nan])

    result = mod.add_depmap_omics_ensemble_gene_id_to_hgnc(hgnc, omics_map)

    assert list(result["symbol"]) == ["G0", "G1", "G2", "G3", "G4"]
    assert list(result["depmap_omics_ensembl_gene_id"].iloc[:3]) == [
        "ENSG3",
        "ENSG1",
        "ENSG2",
    ]
    assert result["depmap_omics_ensembl_gene_id"].iloc[3:].isnull().all()


def test_add_depmap_omics_ensemble_gene_id_to_hgnc_rejects_missing_values():
    for omics_map in [
        pd.DataFrame({"EnsemblGeneID": ["ENSG1", "ENSG2"], "EntrezID": [1.0, np.nan]}),
        pd.DataFrame({"EnsemblGeneID": ["ENSG1", None], "EntrezID": [1.0, 2.0]}),
    ]:
        with pytest.raises(AssertionError, match="missing values"):
            mod.add_depmap_omics_ensemble_gene_id_to_hgnc(_hgnc([1.0, 2.0]), omics_map)


def test_add_depmap_omics_ensemble_gene_id_to_hgnc_rejects_duplicate_rows():
    omics_map = pd.DataFrame(
        {"EnsemblGeneID": ["ENSG1", "ENSG1"], "EntrezID": [1.0, 1.0]}
    )

    with pytest.raises(AssertionError, match="duplicate rows"):
        mod.add_depmap_omics_ensemble_gene_id_to_hgnc(_hgnc([1.0]), omics_map)


def test_add_depmap_omics_ensemble_gene_id_to_hgnc_rejects_ambiguous_mapping():
    one_entrez_two_ensembl = pd.DataFrame(
        {"EnsemblGeneID": ["ENSG1", "ENSG2"], "EntrezID": [1.0, 1.0]}
    )
    with pytest.raises(AssertionError):
        mod.add_depmap_omics_ensemble_gene_id_to_hgnc(
            _hgnc([1.0]), one_entrez_two_ensembl
        )

    one_ensembl_two_entrez = pd.DataFrame(
        {"EnsemblGeneID": ["ENSG1", "ENSG1"], "EntrezID": [1.0, 2.0]}
    )
    with pytest.raises(AssertionError):
        mod.add_depmap_omics_ensemble_gene_id_to_hgnc(
            _hgnc([1.0, 2.0]), one_ensembl_two_entrez
        )


def test_add_depmap_omics_ensemble_gene_id_to_hgnc_rejects_non_integer_ids():
    omics_map = pd.DataFrame({"EnsemblGeneID": ["ENSG1"], "EntrezID": [1.5]})

    with pytest.raises(AssertionError):
        mod.add_depmap_omics_ensemble_gene_id_to_hgnc(_hgnc([1.0]), omics_map)


def test_add_depmap_omics_ensemble_gene_id_to_hgnc_requires_majority_mapped():
    omics_map = pd.DataFrame({"EnsemblGeneID": ["ENSG1"], "EntrezID": [1.0]})

    # only 1 of 3 genes is mapped
    with pytest.raises(AssertionError):
        mod.add_depmap_omics_ensemble_gene_id_to_hgnc(_hgnc([1.0, 2.0, 3.0]), omics_map)


def test_add_depmap_omics_ensemble_gene_id_to_hgnc_requires_entrez_id_column():
    omics_map = pd.DataFrame({"EnsemblGeneID": ["ENSG1"], "EntrezID": [1.0]})
    hgnc = pd.DataFrame({"symbol": ["G0"]})

    with pytest.raises(KeyError):
        mod.add_depmap_omics_ensemble_gene_id_to_hgnc(hgnc, omics_map)
