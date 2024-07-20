#!/usr/bin/env python
import pandas as pd
from taigapy import create_taiga_client_v3
import argparse
import re


def extract_id(x):
    m = re.match(r"\S+ \(([^.]+)\.\d+\)", x)
    if m is None:
        print("Warning: Could not find ensemble ID in:", x)
        return None
    return m.group(1)


def main():
    parser = argparse.ArgumentParser(
        "Reads the fusions table and generates a one-hot encoded matrix of gene fusions"
    )
    parser.add_argument("fusions_dataset_id")
    parser.add_argument("hgnc_dataset_id")
    parser.add_argument("out_csv")
    args = parser.parse_args()

    tc = create_taiga_client_v3()
    fusions = tc.get(args.fusions_dataset_id)

    # use the hgnc dataset to normalize gene symbols
    sym_map = tc.get(args.hgnc_dataset_id)

    # goal: normalize symbols by looking up ensemble IDs to use our latest symbol set and construct a one-hot encoded matrix
    # with DepMap cell line IDs as row labels and columns are of the form "LEFTGENE_RIGHTGENE" where "LEFTGENE" and
    # "RIGHTGENE" are represented by gene symbols.

    symbol_by_ensembl = {
        rec["ensembl_gene_id"]: rec["symbol"] for rec in sym_map.to_records()
    }

    def make_fusion_name(left, right):
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

    fusions["fusion_name"] = [
        make_fusion_name(rec["LeftGene"], rec["RightGene"])
        for rec in fusions.to_records()
    ]

    fusions["one"] = 1
    one_hot = pd.pivot_table(
        fusions,
        values="one",
        columns="ModelID",
        index="fusion_name",
        aggfunc=lambda x: 1,
        fill_value=0,
    )

    one_hot.to_csv(args.out_csv)


if __name__ == "__main__":
    main()
