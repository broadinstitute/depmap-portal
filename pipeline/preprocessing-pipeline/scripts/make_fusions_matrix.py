#!/usr/bin/env python
import pandas as pd
import argparse
import re

from taigapy import create_taiga_client_v3
from omics_preprocessing_utils import preprocess_omics_dataframe


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
    fusions = preprocess_omics_dataframe(fusions, args.fusions_dataset_id)
    fusions["fusion_name"] = [
        rec["CanonicalFusionName"] for rec in fusions.to_records()
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
