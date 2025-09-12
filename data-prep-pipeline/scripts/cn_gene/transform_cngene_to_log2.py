import argparse
import numpy as np
import pandas as pd
from taigapy import create_taiga_client_v3


def transform_cngene_to_log2(cngene_dataset_id: str) -> pd.DataFrame:
    """Transform CN gene expression data to log2 scale"""
    tc = create_taiga_client_v3()

    print("Getting CN gene expression data...")
    cngene_expression_data = tc.get(cngene_dataset_id)

    print("Filtering to default entries per model...")
    filtered_cngene_expression_data = cngene_expression_data[cngene_expression_data["IsDefaultEntryForModel"] == "Yes"].copy()

    assert not filtered_cngene_expression_data["ModelID"].duplicated().any(), "Duplicate ModelID after filtering"
    
    print("Dropping some metadata columns...")
    cols_to_drop = [
        "SequencingID",
        "ModelConditionID",
        "IsDefaultEntryForModel",
        "IsDefaultEntryForMC",
    ]
    existing_cols_to_drop = [c for c in cols_to_drop if c in filtered_cngene_expression_data.columns]
    filtered_cngene_expression_data = filtered_cngene_expression_data.drop(columns=existing_cols_to_drop)

    print("Setting ModelID as index...")
    filtered_cngene_expression_data = filtered_cngene_expression_data.set_index("ModelID")
    filtered_cngene_expression_data.index.name = None

    # Check for columns with ALL NaN values
    count_all_na_columns = filtered_cngene_expression_data.isna().all().sum()
    print(f"Number of columns with ALL NA values: {count_all_na_columns}")
    
    if count_all_na_columns > 0:
        print(f"Data shape before dropping: {filtered_cngene_expression_data.shape}")
        print("Dropping columns with all NaN values...") 
        filtered_cngene_expression_data = filtered_cngene_expression_data.dropna(axis=1, how="all")
        print(f"Data shape after dropping: {filtered_cngene_expression_data.shape}")
    
    print("Transforming CN gene expression data to log2 scale...")
    log2_transformed_data = np.log2(filtered_cngene_expression_data + 1)
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
