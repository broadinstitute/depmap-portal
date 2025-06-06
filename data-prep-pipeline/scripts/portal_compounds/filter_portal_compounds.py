import argparse
import pandas as pd
from taigapy import create_taiga_client_v3
from typing import Set


def filter_sample_ids(sample_ids: str, brd_ids: Set[str]) -> str:
    """
    Filters the SampleIDs based on the following rules:
    - Keep if it starts with 'GDSC' or 'CTRP'.
    - Keep if it starts with 'BRD:' and is in brd_ids.
    """
    kept_ids = set()
    assert isinstance(sample_ids, str)

    for sample_id in sample_ids.split(";"):
        sample_id = sample_id.strip()
        if sample_id.startswith("GDSC") or sample_id.startswith("CTRP"):
            kept_ids.add(sample_id)
        elif sample_id.startswith("BRD:"):
            if sample_id in brd_ids:
                kept_ids.add(sample_id)

    return ";".join(sorted(kept_ids))


def filter_portal_compounds(df: pd.DataFrame, brd_ids: Set[str],) -> pd.DataFrame:
    """
    Filters the portal_compounds DataFrame by keeping only valid SampleIDs according to the
    specified rules. Rows with empty SampleIDs are removed.
    """
    df = df.copy()
    # Use apply to filter SampleIDs
    df["SampleIDs"] = df["SampleIDs"].apply(
        lambda x: filter_sample_ids(x, brd_ids) if pd.notna(x) else ""
    )

    # Remove rows with empty SampleIDs
    df_filtered = df[df["SampleIDs"] != ""]

    assert not df_filtered.empty, "Filtered DataFrame is empty after filtering"

    return df_filtered


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Filter portal compounds data and upload to Taiga."
    )
    parser.add_argument(
        "repsdrug_matrix_taiga_id",
        help="Taiga ID of PRISM Repurposing primary screen data",
    )
    parser.add_argument(
        "repsdrug_auc_matrix_taiga_id",
        help="Taiga ID of PRISM Repurposing secondary screen data",
    )
    parser.add_argument(
        "portal_compounds_taiga_id", help="Taiga ID of portal compounds data"
    )
    parser.add_argument(
        "--prism_oncology_reference_auc_matrix_taiga_id",
        help="Taiga ID of the PRISMOncologyReferenceAUCMatrix (optional)",
        default=None,
    )
    parser.add_argument("output", help="Path to write the output")

    args = parser.parse_args()
    tc = create_taiga_client_v3()

    print("Getting PRISM Repurposing primary screen data...")
    repsdrug_matrix = tc.get(args.repsdrug_matrix_taiga_id)
    assert not repsdrug_matrix.index.empty, "repsdrug_matrix index is empty"

    print("Getting PRISM Repurposing secondary screen data...")
    repsdrug_auc = tc.get(args.repsdrug_auc_matrix_taiga_id)

    print("Getting portal compounds data...")
    portal_compounds_df = tc.get(args.portal_compounds_taiga_id)
    assert not portal_compounds_df.empty, "portal_compounds_df is empty"

    print("Getting oncref AUC matrix data...")
    if (
        args.prism_oncology_reference_auc_matrix_taiga_id is None
        or args.prism_oncology_reference_auc_matrix_taiga_id.startswith("public")
    ):
        oncrefauc_matrix = pd.DataFrame()
    else:
        oncrefauc_matrix = tc.get(args.prism_oncology_reference_auc_matrix_taiga_id)
        assert not oncrefauc_matrix.columns.empty, "oncrefauc_matrix columns are empty"

    print("Computing IDs for filtering...")
    brd_ids = (
        set(repsdrug_matrix.index)
        .union(repsdrug_auc.index)
        .union(["BRD:" + x for x in oncrefauc_matrix.columns])
    )

    print("Filtering portal compounds data...")
    portal_compounds_filtered = filter_portal_compounds(portal_compounds_df, brd_ids)
    print("Filtered portal compounds data")

    if portal_compounds_filtered is not None:
        portal_compounds_filtered.to_csv(args.output, index=False)
