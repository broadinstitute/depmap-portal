import argparse
import re
import pandas as pd
from typing import Dict
from taigapy import create_taiga_client_v3


def extract_id(x: str) -> str:
    """Extract the Ensembl gene ID from a given string."""

    m = re.match(r"\S+ \(([^.]+)\.\d+\)", x)
    if m is None:
        print("Warning: Could not find ensemble ID in:", x)
        return None
    return m.group(1)


def make_fusion_name(left: str, right: str, symbol_by_ensembl) -> str:
    """Create a fusion name from two gene names by combining their symbols."""

    left_ensembl = extract_id(left)
    right_ensembl = extract_id(right)
    left_symbol = symbol_by_ensembl.get(left_ensembl)
    right_symbol = symbol_by_ensembl.get(right_ensembl)
    if (
        left_ensembl is None
        or right_ensembl is None
        or left_symbol is None
        or right_symbol is None
    ):
        # fall back to the symbols in the orignal left and right gene names if we can't figure it out
        left_symbol = left.split(" ")[0]
        right_symbol = right.split(" ")[0]
    return f"{left_symbol}_{right_symbol}"


def generate_fusion_matrix(
    df: pd.DataFrame, symbol_by_ensembl: Dict[str, str]
) -> pd.DataFrame:
    """Transform a DataFrame containing gene fusion information into a one-hot encoded DataFrame."""

    df["fusion_name"] = [
        make_fusion_name(rec["LeftGene"], rec["RightGene"], symbol_by_ensembl)
        for rec in df.to_records()
    ]
    df["one"] = 1
    one_hot = pd.pivot_table(
        df,
        values="one",
        columns="ModelID",
        index="fusion_name",
        aggfunc=lambda x: 1,
        fill_value=0,
    )

    # This is done twice to get rid of the index column names, ModelID and fusion_name
    one_hot.reset_index(inplace=True)
    one_hot.columns.name = None
    one_hot.set_index("fusion_name", inplace=True)
    one_hot = one_hot.transpose()
    one_hot.columns.name = None

    return one_hot


def process_and_transform_fusion(fusion_taiga_id, hgnc_gene_table_csv):

    """Transform fusion data for predictability and upload it to Taiga."""

    tc = create_taiga_client_v3()

    print("Getting fusion data...")
    fusion_filtered_data = tc.get(fusion_taiga_id)
    sym_map_df = pd.read_csv(hgnc_gene_table_csv)
    symbol_by_ensembl = sym_map_df.set_index("ensembl_gene_id")["symbol"].to_dict()

    print("Transforming fusion data...")
    fusion_matrix = generate_fusion_matrix(fusion_filtered_data, symbol_by_ensembl)
    print("Transformed fusion data")

    return fusion_matrix


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate fusion matrix for predictability"
    )
    parser.add_argument("fusion_taiga_id", help="Taiga ID of fusion data")
    parser.add_argument("hgnc_gene_table_csv", help="Path to HGNC gene table")
    parser.add_argument("output", help="Path to write the output")
    args = parser.parse_args()

    fusion_matrix = process_and_transform_fusion(
        args.fusion_taiga_id, args.hgnc_gene_table_csv
    )

    if fusion_matrix is not None:
        fusion_matrix.to_csv(args.output)
