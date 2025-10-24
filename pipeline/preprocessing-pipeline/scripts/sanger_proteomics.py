import argparse
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


def rename_columns(
    df: pd.DataFrame, hgnc_df: pd.DataFrame, uniprot_mapping_df
) -> pd.DataFrame:
    # New name format: gene_symbol (uniprot_id) so that we can store this in our db for Protein
    new_names = {}
    ids_to_remove = []
    for id in df.columns:
        matches = hgnc_df.loc[hgnc_df["uniprot_id"] == id]
        if len(matches) == 0:
            gene_names = uniprot_mapping_df[uniprot_mapping_df["Query"] == id][
                "Gene names"
            ]
            # if no gene matches found in hgnc_df for uniprot_id, try uniprot_mapping_df
            if len(gene_names) > 0:
                # Arbitrarily get first gene name
                gene_name = gene_names.reset_index(drop=True).iloc[0].split()[0]
                new_name = gene_name + " (" + id + ")"
            else:
                ids_to_remove.append(id)
                continue
        else:
            # Uniprot ids and gene symbols in hgnc_df are not necessarily unique so choose first gene symbol
            main_gene_match = matches.reset_index(drop=True).iloc[0]
            new_name = main_gene_match["symbol"] + " (" + id + ")"
        new_names[id] = new_name
    # Remove ids we can't find gene match for
    df.drop(ids_to_remove, axis=1, inplace=True)
    df.rename(columns=new_names, inplace=True)
    return df


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("sanger_proteomics_dataset_id")
    parser.add_argument("hgnc_dataset_id")
    parser.add_argument("uniprot_mapping_dataset_id")
    args = parser.parse_args()

    tc = create_taiga_client_v3()

    df = tc.get(args.sanger_proteomics_dataset_id)

    hgnc_df = tc.get(args.hgnc_dataset_id)
    hgnc_df = hgnc_df[["symbol", "uniprot_ids"]].dropna(subset=["uniprot_ids"])
    hgnc_df = flatten_hgnc(hgnc_df)

    uniprot_mapping_df = tc.get(args.uniprot_mapping_dataset_id)

    df = rename_columns(df, hgnc_df, uniprot_mapping_df)
    # gene/uniprot rows, depmap ids columns
    df = df.transpose()

    df = df.sort_index()
    df = df[sorted(list(df.columns))]

    write_hdf5(df, "sanger_proteomics.hdf5")
