import argparse
import pandas as pd
from typing import Tuple

from taigapy import create_taiga_client_v3

# Constants for calculating selectivity
DEPENDENCY_THRESHOLD = 0.5
SELECTIVITY_THRESHOLD = -0.86


def parse_gene_series(gene_series):
    """
    Parse pandas Series with 'GENE_SYMBOL (entrez_id)' format.
    """
    pattern = r"^(?P<gene_symbol>[^\(]+?)\s*\(\s*(?P<entrez_id>\d+)\s*\)$"
    return gene_series.str.extract(pattern)


def parse_and_validate_genes(gene_series, name):
    """
    Parse and validate gene series, converting entrez_id to numeric.
    """
    parsed = parse_gene_series(gene_series)
    parsed["entrez_id"] = pd.to_numeric(parsed["entrez_id"], errors="coerce")

    if not parsed.notnull().all().all():
        raise ValueError(f"Failed to parse {name}")

    return parsed


def calculate_gene_selectivity(
    crispr_gene_dependency: pd.DataFrame,
    crispr_gene_effect: pd.DataFrame,
    dependency_threshold: float = DEPENDENCY_THRESHOLD,
    selectivity_threshold: float = SELECTIVITY_THRESHOLD,
) -> pd.Series:
    """
    Calculate gene selectivity based on gene dependency and effect data.
    """

    # Count dependent lines for each gene
    dep_lines = (crispr_gene_dependency > dependency_threshold).sum(axis=0)

    # Calculate statistical moments
    skewness = crispr_gene_effect.skew(axis=0)
    kurtosis = crispr_gene_effect.kurtosis(axis=0)

    # Calculate is_strongly_selective
    is_strongly_selective = (skewness * kurtosis < selectivity_threshold) & (
        dep_lines > 0
    )

    return is_strongly_selective


def load_taiga_data(
    tc, hgnc_id: str, ce_id: str, effect_id: str, dependency_id: str
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Load all required datasets from Taiga.
    """
    hgnc_gene_table = tc.get(hgnc_id)
    crispr_inferred_common_essentials = tc.get(ce_id)
    crispr_gene_effect = tc.get(effect_id)
    crispr_gene_dependency = tc.get(dependency_id)

    assert (
        "entrez_id" in hgnc_gene_table.columns
    ), "HGNC table must have 'entrez_id' column"
    assert (
        "Essentials" in crispr_inferred_common_essentials.columns
    ), "Common essentials must have 'Essentials' column"

    return (
        hgnc_gene_table,
        crispr_inferred_common_essentials,
        crispr_gene_effect,
        crispr_gene_dependency,
    )


def add_essentiality_to_hgnc(
    hgnc_gene_table: pd.DataFrame,
    common_essentials: pd.DataFrame,
    gene_effect: pd.DataFrame,
) -> pd.DataFrame:
    """Add essentiality information to HGNC gene table."""
    print(
        "Number of rows in crispr_inferred_common_essentials: ", len(common_essentials)
    )

    parsed_ce = parse_and_validate_genes(
        common_essentials["Essentials"], "common essential genes"
    )
    parsed_gene_effect = parse_and_validate_genes(
        pd.Series(gene_effect.columns), "gene effect column names"
    )

    # Check that all common essentials are in the gene effect matrix
    missing_essentials = ~parsed_ce["entrez_id"].isin(parsed_gene_effect["entrez_id"])
    if missing_essentials.any():
        raise ValueError(
            f"Found {parsed_ce[missing_essentials]['entrez_id'].values} common essential genes that are not in the gene effect matrix"
        )

    # Add a common essential column so that we now have a full gene list with common essentials (the crispr_inferred_common_essentials matrix only contains True values)
    full_gene_list_with_common_essentials = parsed_gene_effect.copy()
    full_gene_list_with_common_essentials[
        "is_common_essential"
    ] = full_gene_list_with_common_essentials["entrez_id"].isin(parsed_ce["entrez_id"])

    print(f"Total genes in gene_effect: {len(parsed_gene_effect)}")
    print(
        f"Common essentials found in gene_effect: {full_gene_list_with_common_essentials['is_common_essential'].sum()}"
    )

    # Add essentiality column to HGNC gene table
    hgnc_gene_table = hgnc_gene_table.copy()
    hgnc_gene_table["entrez_id"] = pd.to_numeric(
        hgnc_gene_table["entrez_id"], errors="coerce"
    )
    essentiality_mapping = full_gene_list_with_common_essentials.set_index("entrez_id")[
        "is_common_essential"
    ].to_dict()

    hgnc_gene_table["essentiality"] = (
        hgnc_gene_table["entrez_id"]
        .map(essentiality_mapping)
        .replace({True: "common essential", False: "not common essential"})
    )

    print(
        f"Essentiality column value counts: {hgnc_gene_table['essentiality'].value_counts(dropna=False)}"
    )

    return hgnc_gene_table


def add_selectivity_to_hgnc(
    hgnc_gene_table: pd.DataFrame,
    gene_dependency: pd.DataFrame,
    gene_effect: pd.DataFrame,
) -> pd.DataFrame:
    """Add selectivity information to HGNC gene table."""
    # Validate that gene dependency and gene effect matrices have the same number of genes
    if len(gene_dependency.columns) != len(gene_effect.columns):
        raise ValueError(
            f"Gene dependency matrix has {len(gene_dependency.columns)} genes "
            f"but gene effect matrix has {len(gene_effect.columns)} genes"
        )

    is_strongly_selective = calculate_gene_selectivity(gene_dependency, gene_effect)

    parsed_strongly_selective = parse_and_validate_genes(
        pd.Series(is_strongly_selective.index), "selectivity gene names"
    )
    parsed_strongly_selective["selectivity"] = is_strongly_selective.values

    selectivity_mapping = parsed_strongly_selective.set_index("entrez_id")[
        "selectivity"
    ].to_dict()

    hgnc_gene_table = hgnc_gene_table.copy()
    hgnc_gene_table["selectivity"] = (
        hgnc_gene_table["entrez_id"]
        .map(selectivity_mapping)
        .replace({True: "strongly selective", False: "not strongly selective"})
    )

    print(
        f"Selectivity column value counts: {hgnc_gene_table['selectivity'].value_counts(dropna=False)}"
    )

    return hgnc_gene_table


def _to_nullable_int(series: pd.Series, name: str) -> pd.Series:
    """IDs may be stored as floats (so they can hold NaNs); convert to nullable Int64,
    asserting that all non-null values are whole numbers."""
    numeric = pd.Series(pd.to_numeric(series, errors="raise"))
    assert (numeric.dropna() % 1 == 0).all(), f"{name} contains non-integer values"
    return numeric.astype("Int64")


def add_depmap_omics_ensemble_gene_id_to_hgnc(
    hgnc_gene_table: pd.DataFrame, depmap_omics_ensembl_map: pd.DataFrame
) -> pd.DataFrame:
    """Asserts that there is a single unique mapping between EnsemblGeneID <-> EntrezID.
    With that confirmed, returns a new table that is hgnc_gene_table plus a
    depmap_omics_ensembl_gene_id column, by joining hgnc_gene_table.entrez_id with
    depmap_omics_ensembl_map.EntrezID."""
    mapping = depmap_omics_ensembl_map[["EnsemblGeneID", "EntrezID"]].copy()

    missing = mapping[mapping.isnull().any(axis=1)]
    assert (
        len(missing) == 0
    ), f"Found {len(missing)} rows in the Omics Ensembl map with missing values: {missing.to_dict('records')[:10]}"

    duplicated_rows = mapping[mapping.duplicated(keep=False)]
    assert (
        len(duplicated_rows) == 0
    ), f"Found duplicate rows in the Omics Ensembl map: {duplicated_rows.to_dict('records')[:10]}"

    mapping["EntrezID"] = _to_nullable_int(mapping["EntrezID"], "EntrezID").astype(
        "int64"
    )

    dup_entrez = mapping[mapping["EntrezID"].duplicated(keep=False)]
    assert (
        len(dup_entrez) == 0
    ), f"EntrezIDs mapping to multiple EnsemblGeneIDs: {dup_entrez.to_dict('records')[:10]}"
    dup_ensembl = mapping[mapping["EnsemblGeneID"].duplicated(keep=False)]
    assert (
        len(dup_ensembl) == 0
    ), f"EnsemblGeneIDs mapping to multiple EntrezIDs: {dup_ensembl.to_dict('records')[:10]}"

    mapping = mapping.rename(
        columns={
            "EntrezID": "entrez_id",
            "EnsemblGeneID": "depmap_omics_ensembl_gene_id",
        }
    ).astype({"entrez_id": "Int64"})

    hgnc_gene_table = hgnc_gene_table.copy()
    hgnc_gene_table["entrez_id"] = _to_nullable_int(
        hgnc_gene_table["entrez_id"], "entrez_id"
    )
    n_rows = len(hgnc_gene_table)
    # left join preserves HGNC row order; many_to_one guards against row duplication
    hgnc_gene_table = hgnc_gene_table.merge(
        mapping, on="entrez_id", how="left", validate="many_to_one"
    )
    assert len(hgnc_gene_table) == n_rows

    n_assigned = hgnc_gene_table["depmap_omics_ensembl_gene_id"].notnull().sum()
    print(
        f"Rows with depmap_omics_ensembl_gene_id: {n_assigned} of {len(hgnc_gene_table)}"
    )
    assert (
        n_assigned > len(hgnc_gene_table) / 2
    ), f"Expected more than half of genes to be assigned a depmap_omics_ensembl_gene_id, but only {n_assigned} of {len(hgnc_gene_table)} were"
    return hgnc_gene_table


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Add common essential and selectivity to HGNC gene table."
    )
    parser.add_argument("hgnc_gene_table_taiga_id", help="Taiga ID of HGNC gene table")
    parser.add_argument(
        "crispr_inferred_common_essentials_taiga_id",
        help="Taiga ID of CRISPR inferred common essentials",
    )
    parser.add_argument(
        "crispr_gene_effect_taiga_id", help="Taiga ID of CRISPR gene effect"
    )
    parser.add_argument(
        "crispr_gene_dependency_taiga_id", help="Taiga ID of CRISPR gene dependency"
    )
    parser.add_argument(
        "depmap_omics_ensembl_map_taiga_id",
        help="Taiga ID of entrez_id -> ensemble mapping provided by Omics team",
    )
    parser.add_argument("output", help="Path to write the output")
    args = parser.parse_args()

    tc = create_taiga_client_v3()

    # Load all data
    (
        hgnc_gene_table,
        crispr_inferred_common_essentials,
        crispr_gene_effect,
        crispr_gene_dependency,
    ) = load_taiga_data(
        tc,
        args.hgnc_gene_table_taiga_id,
        args.crispr_inferred_common_essentials_taiga_id,
        args.crispr_gene_effect_taiga_id,
        args.crispr_gene_dependency_taiga_id,
    )

    depmap_omics_ensembl_map = tc.get(args.depmap_omics_ensembl_map_taiga_id)
    assert set(depmap_omics_ensembl_map.columns) == set(["EnsemblGeneID", "EntrezID"])

    # Add essentiality
    hgnc_gene_table = add_essentiality_to_hgnc(
        hgnc_gene_table, crispr_inferred_common_essentials, crispr_gene_effect
    )

    # Add selectivity
    hgnc_gene_table = add_selectivity_to_hgnc(
        hgnc_gene_table, crispr_gene_dependency, crispr_gene_effect
    )

    # Add depmap_omics_ensemble_gene_id
    hgnc_gene_table = add_depmap_omics_ensemble_gene_id_to_hgnc(
        hgnc_gene_table, depmap_omics_ensembl_map
    )

    hgnc_gene_table.to_csv(args.output, index=False)
