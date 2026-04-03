import collections
import argparse
import pandas as pd
from taigapy import create_taiga_client_v3
from typing import Set, Dict, List


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


def filter_portal_compounds(df: pd.DataFrame, brd_ids: Set[str]) -> pd.DataFrame:
    """
    Filters the portal_compounds DataFrame by keeping only valid SampleIDs according to the
    specified rules. Rows with empty SampleIDs are removed.
    """
    df = df.copy()

    df["SampleIDs"] = df["SampleIDs"].apply(
        lambda x: filter_sample_ids(x, brd_ids) if pd.notna(x) else ""
    )

    df_filtered = df[df["SampleIDs"] != ""]

    assert not df_filtered.empty, "Filtered DataFrame is empty after filtering"

    return df_filtered


def check_for_all_ids(df, brd_id_to_sources: Dict[str, List[str]]):
    remaining_sample_ids = set()
    for sample_ids in df["SampleIDs"]:
        remaining_sample_ids.update(sample_ids.split(";"))

    missing_count = 0
    for brd_id, sources in brd_id_to_sources.items():
        if brd_id not in remaining_sample_ids:
            print(f"Could not find {brd_id} which was referenced in {sources}")
            missing_count += 1
    assert missing_count < 120, f"{missing_count} missing IDs"


def collect_brd_ids(tc, matrices, tables, column_matrices):
    """
    Collect BRD sample IDs from multiple data sources:
    - matrices: Taiga IDs of matrices whose .index contains BRD IDs
    - tables: Taiga IDs of tables whose 'SampleID' column contains BRD IDs
    - column_matrices: Taiga IDs of matrices whose .columns contain BRD IDs
                       (prefixed with 'BRD:' for normalization)
    """
    brd_ids = set()
    brd_sources = collections.defaultdict(list)

    def add_brd_ids(ids, source):
        for brd_id in ids:
            if brd_id.startswith("PRC-"):
                brd_id = "BRD:" + brd_id
            if brd_id.startswith("BRD:"):
                brd_ids.add(brd_id)
                brd_sources[brd_id].append(source)
            else:
                raise Exception(f"Invalid BRD ID: {brd_id} in {source}")

    for matrix_taiga_id in matrices:
        print(f"Getting {matrix_taiga_id} for index")
        matrix = tc.get(matrix_taiga_id)
        add_brd_ids(matrix.index, matrix_taiga_id)

    for table_taiga_id in tables:
        print(f"Getting {table_taiga_id} for SampleID column")
        table = tc.get(table_taiga_id)
        add_brd_ids(table["SampleID"], table_taiga_id)

    for matrix_taiga_id in column_matrices:
        print(f"Getting {matrix_taiga_id} for columns")
        matrix = tc.get(matrix_taiga_id)
        add_brd_ids(["BRD:" + col for col in matrix.columns], matrix_taiga_id)

    return brd_ids, brd_sources


def main():
    parser = argparse.ArgumentParser(
        description="Filter portal compounds data and upload to Taiga."
    )
    parser.add_argument(
        "master_portal_compounds_taiga_id",
        help="Taiga ID of the full merged list of all compounds",
    )
    parser.add_argument(
        "--index-of-matrix",
        help="Taiga ID of a matrix whose row index contains BRD sample IDs",
        action="append",
    )
    parser.add_argument(
        "--sample-id-of-table",
        help="Taiga ID of a table whose 'SampleID' column contains BRD sample IDs",
        action="append",
    )
    parser.add_argument(
        "--column-of-matrix",
        help="Taiga ID of a matrix whose columns contain BRD sample IDs (will be prefixed with 'BRD:')",
        action="append",
    )
    parser.add_argument("output", help="Path to write the output CSV")

    args = parser.parse_args()
    tc = create_taiga_client_v3()

    brd_ids, brd_sources = collect_brd_ids(
        tc,
        matrices=args.index_of_matrix or [],
        tables=args.sample_id_of_table or [],
        column_matrices=args.column_of_matrix or [],
    )

    print(f"Collected {len(brd_ids)} unique BRD IDs from input sources")

    portal_compounds_df = tc.get(args.master_portal_compounds_taiga_id)
    assert not portal_compounds_df.empty, "portal_compounds_df is empty"

    print("Filtering portal compounds data...")
    portal_compounds_filtered = filter_portal_compounds(portal_compounds_df, brd_ids)
    print(
        f"Filtered: {len(portal_compounds_filtered)} compounds retained "
        f"(from {len(portal_compounds_df)} total)"
    )

    check_for_all_ids(portal_compounds_filtered, brd_sources)

    portal_compounds_filtered.to_csv(args.output, index=False)


if __name__ == "__main__":
    main()
