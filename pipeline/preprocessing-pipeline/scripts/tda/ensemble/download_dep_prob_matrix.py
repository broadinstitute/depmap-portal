import argparse
import pandas as pd
from taigapy import create_taiga_client_v3

GENE_LABEL_FORMAT = r"^[a-zA-Z\d\-]+ \(\d+\)$"

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("dep_matrix")
    parser.add_argument("cell_line_metadata")

    args = parser.parse_args()

    tc = create_taiga_client_v3()
    df = tc.get(args.dep_matrix)
    # Filter out all columns that don't match the expected gene label format
    columns_valid = df.columns.str.match(GENE_LABEL_FORMAT)
    df.columns[~columns_valid].to_series(name="invalid_gene_labels").to_csv(
        "invalid_labels.csv", index=False
    )
    df = df[df.columns[columns_valid]]

    cell_line_metadata = pd.read_csv(args.cell_line_metadata, index_col=0)
    cell_line_metadata.set_index("arxspan_id")

    if len(set(cell_line_metadata.arxspan_id).intersection(set(df.index))) == 0:
        ccle_name_to_depmap_id = d = pd.Series(
            cell_line_metadata.arxspan_id.values, index=cell_line_metadata.ccle_name
        ).to_dict()

        for _, row in cell_line_metadata[
            pd.notna(cell_line_metadata.alt_names)
        ].iterrows():
            alt_names = row.alt_names.split(" ")
            ccle_name_to_depmap_id.update(
                {alt_name: row.arxspan_id for alt_name in alt_names}
            )

        df.index = df.index.map(ccle_name_to_depmap_id)
        df = df.loc[df.index.notna()]

    df.index.name = "Row.name"
    df.sort_index(inplace=True, axis=0)
    df.sort_index(inplace=True, axis=1)

    df.reset_index().to_feather("dep_prob.ftr")
