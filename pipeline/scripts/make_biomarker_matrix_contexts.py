import argparse
from hdf5_utils import write_hdf5


def main(
    subtype_context_taiga_id, subtype_tree_taiga_id, out_hdf5_filename, out_filename
):
    from taigapy import create_taiga_client_v3

    tc = create_taiga_client_v3()

    # tree_df contains the info need to filter out Molecular Subtypes
    tree_df = tc.get(subtype_tree_taiga_id)
    # Make sure the column to filter on exists
    assert "TreeType" in tree_df.columns.values.tolist()

    # There are 3 possible types of codes that act as a primary key
    lineage_subtype_codes_df = tree_df[
        ["DepmapModelType", "OncotreeCode", "MolecularSubtypeCode"]
    ][tree_df["TreeType"] == "Lineage"]
    # Get a list of unique codes
    depmap_model_types = lineage_subtype_codes_df["DepmapModelType"].values.tolist()
    oncotree_codes = lineage_subtype_codes_df["OncotreeCode"].values.tolist()
    data_driven_subtypes = lineage_subtype_codes_df[
        "MolecularSubtypeCode"
    ].values.tolist()
    codes = set(depmap_model_types + oncotree_codes + data_driven_subtypes)
    codes.discard(None)
    unique_lineage_tree_codes = list(codes)

    # Get the context matrix. This includes MolecularSubtypes, which we don't want in the output.
    one_hot_encoded_context_matrix = tc.get(subtype_context_taiga_id)
    assert len(tree_df) == len(one_hot_encoded_context_matrix.columns)

    # Remove the MolecularSubtype columns
    no_mol_subtypes_one_hot_encoded_context_matrix = one_hot_encoded_context_matrix[
        unique_lineage_tree_codes
    ]
    mol_subtype_nodes = tree_df[tree_df["TreeType"] == "MolecularSubtype"]
    assert len(mol_subtype_nodes) == len(one_hot_encoded_context_matrix.columns) - len(
        unique_lineage_tree_codes
    )

    bool_matrix = no_mol_subtypes_one_hot_encoded_context_matrix.astype(bool)

    write_hdf5(
        no_mol_subtypes_one_hot_encoded_context_matrix.transpose(), out_hdf5_filename
    )
    bool_matrix.to_csv(out_filename)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("subtype_context_taiga_id")
    parser.add_argument("subtype_tree_taiga_id")
    parser.add_argument("out_hdf5_filename")
    parser.add_argument("out_filename")
    args = parser.parse_args()
    main(
        args.subtype_context_taiga_id,
        args.subtype_tree_taiga_id,
        args.out_hdf5_filename,
        args.out_filename,
    )
