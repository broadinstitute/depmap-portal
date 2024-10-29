import pandas as pd
from taigapy import create_taiga_client_v3

from config import portal_compounds_taiga_id
from datarelease_taiga_permanames import prism_oncref_auc_matrix_taiga_permaname
from utils import update_taiga

repsdrug_matrix_taiga_id = (
    "public-non-quarterly-processed-files-8e90.64/repsdrug-matrix"
)
repsdrug_auc_matrix_taiga_id = (
    "public-non-quarterly-processed-files-8e90.64/repsdrug-auc-matrix"
)


def filter_sample_ids(
    sample_ids: str,
    repsdrug_matrix: pd.DataFrame,
    repsdrug_auc: pd.DataFrame,
    oncrefauc_matrix: pd.DataFrame,
) -> str:
    """
    Filters the SampleIDs based on the following rules:
    - Keep if it starts with 'GDSC' or 'CTRP'.
    - Keep if it starts with 'BRD:' and is in repsdrug_matrix or repsdrug_auc.
    - Keep if the stripped version (without 'BRD:') is in oncrefauc_matrix columns.
    """
    kept_ids = []

    for sample_id in sample_ids.split(";"):
        if sample_id.startswith("GDSC") or sample_id.startswith("CTRP"):
            kept_ids.append(sample_id)
        elif sample_id.startswith("BRD"):
            # Check in repsdrug_matrix and repsdrug_auc
            if sample_id in repsdrug_matrix.index or sample_id in repsdrug_auc.index:
                kept_ids.append(sample_id)
            else:
                # Strip "BRD:" and check in oncrefauc_matrix columns
                stripped_id = sample_id.replace("BRD:", "")
                if stripped_id in oncrefauc_matrix.columns:
                    kept_ids.append(sample_id)

    return ";".join(kept_ids)


def filter_portal_compounds(
    df: pd.DataFrame,
    repsdrug_matrix: pd.DataFrame,
    repsdrug_auc: pd.DataFrame,
    oncrefauc_matrix: pd.DataFrame,
) -> pd.DataFrame:
    """
    Filters the portal_compounds DataFrame by keeping only valid SampleIDs according to the
    specified rules. Rows with empty SampleIDs are removed.
    """
    df = df.copy()
    # Use apply to filter SampleIDs
    df["SampleIDs"] = df["SampleIDs"].apply(
        lambda x: filter_sample_ids(x, repsdrug_matrix, repsdrug_auc, oncrefauc_matrix)
        if pd.notna(x)
        else ""
    )

    # Remove rows with empty SampleIDs
    df_filtered = df[df["SampleIDs"] != ""]

    return df_filtered


def process_and_update_portal_compounds(source_dataset_id, target_dataset_id):
    """Filter portal compounds data and upload to Taiga."""
    tc = create_taiga_client_v3()

    print("Getting portal compounds data...")
    portal_compounds_df = tc.get(portal_compounds_taiga_id)

    print("Getting repsdrug matrix data...")
    repsdrug_matrix = tc.get(repsdrug_matrix_taiga_id)

    print("Getting repsdrug AUC matrix data...")
    repsdrug_auc = tc.get(repsdrug_auc_matrix_taiga_id)

    print("Getting oncref AUC matrix data...")
    oncrefauc_matrix = tc.get(
        f"{source_dataset_id}/{prism_oncref_auc_matrix_taiga_permaname}"
    )

    print("Filtering portal compounds data...")
    portal_compounds_filtered = filter_portal_compounds(
        portal_compounds_df, repsdrug_matrix, repsdrug_auc, oncrefauc_matrix
    )
    print("Filtered portal compounds data")

    # Update Taiga
    update_taiga(
        portal_compounds_filtered,
        "Filter portal compounds data",
        target_dataset_id,
        "PortalCompounds",
        file_format="csv_table",
    )
