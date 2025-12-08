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

    # Use apply to filter SampleIDs
    df["SampleIDs"] = df["SampleIDs"].apply(
        lambda x: filter_sample_ids(x, brd_ids) if pd.notna(x) else ""
    )

    # Remove rows with empty SampleIDs
    df_filtered = df[df["SampleIDs"] != ""]

    assert not df_filtered.empty, "Filtered DataFrame is empty after filtering"

    return df_filtered


def check_for_all_ids(df, brd_id_to_sources: Dict[str, List[str]]):
    # compute the union of all SampleIDs
    remaining_sample_ids = set()
    for sample_ids in df["SampleIDs"]:
        remaining_sample_ids.update(sample_ids.split(";"))

    # now identify which samples aren't in the final version, but _were_ in the original compound lists
    missing_count = 0
    for brd_id, sources in brd_id_to_sources.items():
        if brd_id not in remaining_sample_ids:
            print(f"Could not find {brd_id} which was referenced in {sources}")
            missing_count += 1
    assert missing_count < 120, f"{missing_count} missing IDs"


def main():
    parser = argparse.ArgumentParser(
        description="Filter portal compounds data and upload to Taiga."
    )
    parser.add_argument(
        "master_portal_compounds_taiga_id",
        help="Taiga ID of the full merged list all of compounds",
    )
    parser.add_argument(
        "--index-of-matrix",
        help="Matrix to look for sample IDs within",
        action="append",
    )
    parser.add_argument(
        "--sample-id-of-table",
        help="Table to look for sample IDs within 'SampleID' column",
        action="append",
    )
    parser.add_argument("output", help="Path to write the output")

    args = parser.parse_args()
    tc = create_taiga_client_v3()

    matrices = args.index_of_matrix or []
    tables = args.sample_id_of_table or []

    brd_ids = set()
    brd_sources = collections.defaultdict(lambda: [])

    def add_brd_ids(ids, source):
        for id in ids:
            if id.startswith("PRC-"):
                id = "BRD:" + id
            if id.startswith("BRD:"):
                brd_ids.add(id)
                brd_sources[id].append(source)
            else:
                raise Exception(f"Invalid BRD ID: {id} in {source}")

    for matrix_taiga_id in matrices:
        print(f"Getting {matrix_taiga_id} for index")
        matrix = tc.get(matrix_taiga_id)
        add_brd_ids(matrix.index, matrix_taiga_id)

    for table_taiga_id in tables:
        print(f"Getting {table_taiga_id} for SampleID column")
        table = tc.get(table_taiga_id)
        add_brd_ids(table["SampleID"], table_taiga_id)

    portal_compounds_df = tc.get(args.master_portal_compounds_taiga_id)

    #
    # compound_id_by_sample_id = {}
    # for row in portal_compounds_df.to_records():
    #     for sample_id in row['SampleIDs'].split(";"):
    #         compound_id_by_sample_id[sample_id] = row['CompoundID']
    #
    # print("Getting PRISM Repurposing primary screen data...")
    # repsdrug_matrix = tc.get(args.repsdrug_matrix_taiga_id)
    # assert not repsdrug_matrix.index.empty, "repsdrug_matrix index is empty"
    #
    # print("Getting PRISM Repurposing secondary screen data...")
    # repsdrug_auc = tc.get(args.repsdrug_auc_matrix_taiga_id)
    #
    #
    # print("Getting oncref AUC matrix data...")
    # oncrefauc_matrix = tc.get(args.prism_oncology_reference_auc_matrix_taiga_id)
    # assert not oncrefauc_matrix.columns.empty, "oncrefauc_matrix columns are empty"
    #
    # print("Getting oncref seq log2 AUC matrix data...")
    # oncref_seq_log2_auc_matrix = tc.get(
    #     args.prism_oncology_reference_seq_log2_auc_matrix_taiga_id
    # )
    # assert (
    #     not oncref_seq_log2_auc_matrix.columns.empty
    # ), "oncref_seq_log2_auc_matrix columns are empty"
    #
    # print("Computing IDs for filtering...")
    # brd_id_with_sources = collections.defaultdict(list)
    #
    # compound_ids = set( list(repsdrug_matrix.columns) + list(repsdrug_auc.columns) )
    #
    # source_to_brds = {
    #     "oncrefauc_matrix": ["BRD:" + x for x in oncrefauc_matrix.columns],
    #     "oncref_seq_log2_auc_matrix": ["BRD:" + x for x in oncref_seq_log2_auc_matrix.columns]
    # }
    #
    # for name, ids in source_to_brds.items():
    #     for id in ids:
    #         brd_id_with_sources[id].append(name)
    #         cid = compound_id_by_sample_id.get(id)
    #         if cid is None:
    #             print("missing id", id)
    #             continue
    #         compound_ids.add(cid)
    #
    print("Filtering portal compounds data...")
    portal_compounds_filtered = filter_portal_compounds(portal_compounds_df, brd_ids)
    print("Filtered portal compounds data")

    check_for_all_ids(portal_compounds_filtered, brd_sources)

    if portal_compounds_filtered is not None:
        portal_compounds_filtered.to_csv(args.output, index=False)


if __name__ == "__main__":
    main()
