import argparse

from taigapy import create_taiga_client_v3
from omics_preprocessing_utils import preprocess_omics_dataframe


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mutations_dataset_id")
    parser.add_argument("hgnc_dataset_id")
    parser.add_argument("output_file")
    args = parser.parse_args()

    tc = create_taiga_client_v3()

    # hgnc = tc.get(args.hgnc_dataset_id)
    # hgnc = hgnc[["symbol", "entrez_id"]].dropna()
    # hgnc["label"] = hgnc["symbol"] + " (" + hgnc["entrez_id"].map(int).map(str) + ")"
    # hgnc = hgnc.set_index("symbol")

    mutations = tc.get(args.mutations_dataset_id)
    mutations = preprocess_omics_dataframe(mutations, args.mutations_dataset_id)
    # Set ModelID as index
    if "ModelID" in mutations.columns:
        mutations = mutations.set_index("ModelID")
        mutations.index.name = None

    mutations = mutations.astype(int)
    # Drop columns that are not in the HGNC dataset (because we don't have a label)
    # print(mutations)
    # mutations = mutations.drop(columns=mutations.columns.difference(hgnc.index))
    # mutations = mutations.rename(columns=hgnc["label"])

    mutations = mutations.sort_index(axis=0).sort_index(axis=1)
    mutations.T.to_csv(args.output_file)
