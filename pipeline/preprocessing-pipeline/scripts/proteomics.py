import argparse
import re
import urllib
import pandas as pd
from taigapy import create_taiga_client_v3

from hdf5_utils import write_hdf5


def flatten_hgnc(hgnc_df: pd.DataFrame) -> pd.DataFrame:
    new_hgnc = pd.DataFrame(
        hgnc_df["uniprot_ids"].str.split("|").tolist(), index=hgnc_df["symbol"]
    ).stack()
    new_hgnc = new_hgnc.reset_index([0, "symbol"])
    new_hgnc = new_hgnc.rename(columns={0: "uniprot_id"})
    return new_hgnc


def add_gene(
    df: pd.DataFrame, hgnc_df: pd.DataFrame, uniprot_mapping_df: pd.DataFrame
) -> pd.DataFrame:
    df["Canonical Uniprot ID (Proteins)"] = uniprot_mapping_df.reindex(
        df["Uniprot_Acc"],
    )["Entry"].values
    hgnc_df["Canonical Uniprot ID (HGNC)"] = uniprot_mapping_df.reindex(
        hgnc_df["uniprot_id"],
    )["Entry"].values

    df = df.merge(
        hgnc_df,
        left_on="Canonical Uniprot ID (Proteins)",
        right_on="Canonical Uniprot ID (HGNC)",
    )
    return df


def unify_uniprot_cols(df: pd.DataFrame) -> pd.DataFrame:
    # If the proteomics UniProt ID contains isoform information (contains "-"), use
    # that, otherwise, use the ID from HGNC
    df["Uniprot_unified"] = df.apply(
        lambda row: row["Uniprot_Acc"]
        if "-" in row["Uniprot_Acc"]
        else row["uniprot_id"],
        axis=1,
    )
    return df


def create_ids(df: pd.DataFrame) -> pd.DataFrame:
    df["id"] = df["symbol"] + " (" + df["Uniprot_unified"] + ")"

    # Drop duplicates
    duplicated = df[df.id.duplicated(False)]
    df = df.drop(duplicated.index)
    seen = set()
    keep_indexes = set()
    for index, row in duplicated.iterrows():
        if (
            row["Uniprot_Acc"] == row["Uniprot_unified"]
            and row["Uniprot_unified"] not in seen
        ):
            seen.add(row["Uniprot_unified"])
            keep_indexes.add(index)
    for index, row in duplicated.iterrows():
        if row["Uniprot_unified"] not in seen:
            seen.add(row["Uniprot_unified"])
            keep_indexes.add(index)

    keep_indexes = list(keep_indexes)
    df = df.append(duplicated.reindex(keep_indexes))

    df = df.set_index("id")
    return df


def get_arxspan(df: pd.DataFrame, cell_line_metadata: pd.DataFrame) -> pd.DataFrame:
    cell_line_cols = [col for col in df.columns if re.match(r".*_TenPx\d*", col)]
    df = df[cell_line_cols]
    renames = {}
    for col in df.columns:
        ccle_name = re.split(r"_TenPx\d*", col)[0]

        filtered_data = cell_line_metadata[cell_line_metadata["ccle_name"] == ccle_name]

        # arxspan_id = cell_line_metadata[
        #     cell_line_metadata["ccle_name"] == ccle_name
        # ].iloc[0]["arxspan_id"]

        if not filtered_data.empty:
            arxspan_id = filtered_data.iloc[0]["arxspan_id"]
        else:
            print(f"ccle_name: {ccle_name}")
            print("\n")
            print("No rows match the given criteria.")
            print("\n")
            continue
        renames[col] = arxspan_id
    df = df.rename(columns=renames)
    df = df.groupby(df.columns, axis=1).mean()
    return df


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("proteomics_dataset_id")
    parser.add_argument("hgnc_dataset_id")
    parser.add_argument("uniprot_mapping_dataset_id")
    parser.add_argument("cell_line_metadata")
    args = parser.parse_args()

    tc = create_taiga_client_v3()

    df = tc.get(args.proteomics_dataset_id)

    hgnc_df = tc.get(args.hgnc_dataset_id)
    hgnc_df = hgnc_df.dropna(subset=["uniprot_ids"])
    hgnc_df = flatten_hgnc(hgnc_df)

    uniprot_mapping_df = tc.get(args.uniprot_mapping_dataset_id)
    uniprot_mapping_df = uniprot_mapping_df.set_index("Query")

    df = add_gene(df, hgnc_df, uniprot_mapping_df)
    df = unify_uniprot_cols(df)
    df = create_ids(df)

    cell_line_metadata = pd.read_csv(args.cell_line_metadata, index_col=0)
    df = get_arxspan(df, cell_line_metadata)

    df = df.sort_index()
    df = df[sorted(list(df.columns))]

    write_hdf5(df, "proteomics.hdf5")
