import argparse
import pandas as pd
from pathlib import Path


def process_and_generate_genetic_derangement(
    cngene_log2_csv: Path, hgnc_gene_table_csv: Path
) -> pd.DataFrame:

    """Generate genetic derangement data for predictability"""

    print("Getting log2 transformed CNGene data...")
    cn_data = pd.read_csv(
        cngene_log2_csv, index_col=0
    )  # Use index_col=0 to properly handle Model IDs
    # The input CSV has Model IDs in the first column without a column header.
    # Without index_col=0, Pandas would create a new numeric index (0,1,2...) and the Model IDs would become a regular column named 'Unnamed: 0'
    # With index_col=0, Model IDs are correctly set as the index maintaining the original data structure from conseq

    cn_stripped = cn_data.copy()
    cn_stripped.columns = [s.split(" ")[0] for s in cn_data.columns]

    hgnc_gene_table = pd.read_csv(hgnc_gene_table_csv)
    cytoband_data = hgnc_gene_table[["symbol", "location"]]

    print("Generating genetic derangement data...")
    genetic_derangement_matrix = cn_stripped.groupby(
        cytoband_data.set_index("symbol")["location"], axis=1
    ).mean()
    print("Generated genetic derangement data")

    genetic_derangement_matrix.columns.name = None

    return genetic_derangement_matrix


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate Gentetic Derangement matrix for predictability"
    )
    parser.add_argument("cngene_log2_csv", help="Path to log2 transformed CNGene data")
    parser.add_argument("hgnc_gene_table_csv", help="Path to HGNC gene table")
    parser.add_argument("output", help="Path to write the output")
    args = parser.parse_args()
    genetic_derangement_matrix = process_and_generate_genetic_derangement(
        args.cngene_log2_csv, args.hgnc_gene_table_csv
    )

    if genetic_derangement_matrix is not None:
        genetic_derangement_matrix.to_csv(args.output)
