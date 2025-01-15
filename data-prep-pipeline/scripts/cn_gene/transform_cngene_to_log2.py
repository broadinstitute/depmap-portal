import argparse
import numpy as np
import pandas as pd
from taigapy import create_taiga_client_v3


def transform_cngene_to_log2(cngene_dataset_id: str) -> pd.DataFrame:
    """Transform CN gene expression data to log2 scale"""
    tc = create_taiga_client_v3()

    print("Getting CN gene expression data...")
    cngene_expression_data = tc.get(cngene_dataset_id)

    print("Transforming CN gene expression data to log2 scale...")
    log2_transformed_data = np.log2(cngene_expression_data + 1)
    print("Transformed CN gene expression data to log2 scale")

    return log2_transformed_data


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Transform CN gene expression data to log2 scale."
    )
    parser.add_argument("cngene_taiga_id", help="Taiga ID of CN gene expression data")
    parser.add_argument("output", help="Path to write the output")
    args = parser.parse_args()
    log2_transformed_data = transform_cngene_to_log2(args.cngene_taiga_id)
    if log2_transformed_data is not None:
        log2_transformed_data.to_csv(args.output)
