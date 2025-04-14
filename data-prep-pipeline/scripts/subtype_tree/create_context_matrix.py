import argparse
import pandas as pd
from taigapy import create_taiga_client_v3
import re

# TODO FOR 25Q2: REMOVE THE USE OF THIS TEMPORARY MODEL FILE
temp_model_id = "alison-test-649a.18/Model_temp_between_24q4_25q2"


def load_data(model_taiga_id, molecular_subtypes_taiga_id, subtype_tree_path):
    """
    A function to load all data necessary to create the context matrix
    """
    tc = create_taiga_client_v3()

    # HACK
    # This is intended to use a temporary model file while waiting for a change in
    # the model table that is coming in 25q2.
    release_quarter = re.search("2[0-9]q[2|4]", model_taiga_id).group()
    if release_quarter == "24q4":
        model_taiga_id = temp_model_id

    assert (
        release_quarter == "24q4",
        "If this assert gets hit, take out the above hack. We do not want to change the model_taiga_id's value anymore.",
    )

    ## Load the models table
    # TODO FOR 25Q2: change taiga id to be model_taiga_id
    models = (
        tc.get(temp_model_id)
        .loc[
            :,
            [
                "ModelID",
                "OncotreeCode",
                "DepmapModelType",
                "OncotreeLineage",
                "OncotreePrimaryDisease",
                "OncotreeSubtype",
            ],
        ]
        .dropna(subset=["OncotreeLineage", "OncotreeSubtype"])
    )

    ## Load the subtype tree
    # the subtype tree is created using a different script within the data prep pipeline
    # we want to grab it from where it was just saved
    subtype_tree = pd.read_csv(subtype_tree_path)

    ## Load genetic subtypes
    genetic_subtypes = tc.get(molecular_subtypes_taiga_id).set_index("ModelID")

    ## construct the Model-Tree
    model_tree = models.loc[:, ["ModelID", "OncotreeCode", "DepmapModelType"]].merge(
        subtype_tree
    )

    return model_tree, subtype_tree, genetic_subtypes


def get_context_models(subtype_node, subtype_tree, genetic_subtypes, model_tree):
    """
    A function to find the set of models that belong to any particular context

    Inputs:
        - subtype_node (pd.Series): one row of the subtype tree
        - subtype_tree (pandas df): The subtype tree as created by create_subtype_tree.py
        - genetic_subtypes (pandas df): The OmicsInferredMolecularSubtypes release file
        - model_tree (pandas df): The model table merged with the subtype tree, so that
            each model is annotated with the complete path of nodes all the way down
            to its annotated Oncotree/DepmapModelType code

    Outputs:
        - st_models (list): a list of Model ID's that belong to the input subtype
    """

    # if the subtype is an oncotree or depmap code, then this is a very easy problem to solve
    if subtype_node.NodeSource in ["Oncotree", "Depmap"]:
        st_models = model_tree[
            model_tree[f"Level{subtype_node.NodeLevel}"] == subtype_node.NodeName
        ].ModelID

    # if the subtype originates from the genetic subtypes whitelist,
    # then we find the list of models that are a member of the parent context
    # AND are set to True for that subtype in the OmicsInferredMolecularSubtype file
    elif subtype_node.NodeSource == "Data-driven genetic subtype":
        # get the name of the lineage-based parent and the genetic subtype column
        parent_name, gs_name = subtype_node.NodeName.split(": ")

        # find the models that are a member of the lineage-based parent
        parent_models = get_context_models(
            subtype_tree[subtype_tree.NodeName == parent_name].iloc[0],
            subtype_tree,
            genetic_subtypes,
            model_tree,
        )

        # find the models that are a member of the data-driven subtype
        gs_models = genetic_subtypes[genetic_subtypes[gs_name] == True].index

        # find the models that are a member of both
        st_models = list(set.intersection(set(parent_models), set(gs_models)))

    # if the subtype originates from the OmicsInferredMolecularSubtype file,
    # we can either use it as a column directly, or call recursively
    elif subtype_node.NodeSource == "Omics Inferred Molecular Subtype":
        if subtype_node.NodeName in genetic_subtypes.columns:
            # it is a full subtype and is already in the matrix
            st_models = genetic_subtypes[
                genetic_subtypes[subtype_node.NodeName] == True
            ].index

        else:
            # it is a top level "gene", find all the children
            gene_child_nodes = subtype_tree[
                (subtype_tree.Level0 == subtype_node.NodeName)
                & (subtype_tree.NodeName != subtype_node.NodeName)
            ]

            # get the union of models that are members of all child nodes
            st_models = []
            for idx, child in gene_child_nodes.iterrows():
                # call this function to get the models in each subtype's list
                st_models = st_models + list(
                    get_context_models(
                        subtype_node=child,
                        subtype_tree=subtype_tree,
                        genetic_subtypes=genetic_subtypes,
                        model_tree=model_tree,
                    )
                )

            # drop repeat models
            st_models = list(set(st_models))

    return st_models


def construct_matrix(model_tree, subtype_tree, genetic_subtypes):
    """
    A function that takes each node in the subtype_tree, constructs a one-hot 
    encoded column that describes which models are members of that node, and
    turns it into a matrix

    Inputs:
        - model_tree (pandas df): The model table merged with the subtype tree, so that
            each model is annotated with the complete path of nodes all the way down
            to its annotated Oncotree/DepmapModelType code
        - subtype_tree (pandas df): The subtype tree as created by create_subtype_tree.py
        - genetic_subtypes (pandas df): The OmicsInferredMolecularSubtypes release file

    Outputs:
        - context_matrix (pandas df): A one-hot encoded matrix with model id's as 
            rows and context codes as columns. Describes which models are members
            of which contexts. There is a column in the context_matrix for every
            row in the subtype_tree.
    """
    ctx_cols = []
    for idx, st in subtype_tree.iterrows():
        # for every node in the tree, find the list of models that are members of
        # this context
        st_models = get_context_models(
            subtype_node=st,
            subtype_tree=subtype_tree,
            genetic_subtypes=genetic_subtypes,
            model_tree=model_tree,
        )

        # determine which column contains the code
        if st.NodeSource in ["Oncotree", "Depmap"]:
            ctx_code = st.DepmapModelType

        else:
            ctx_code = st.MolecularSubtypeCode

        # create a one-hot encoded series object for this context
        st_ctx = pd.Series(index=model_tree.ModelID, name=ctx_code, data=0)
        st_ctx.loc[st_models] = 1

        # save the series to the list of columns
        ctx_cols.append(st_ctx)

    context_matrix = pd.DataFrame(ctx_cols).T.sort_index(axis=0).sort_index(axis=1)

    return context_matrix


def sanity_check_results(subtype_tree, context_matrix):
    """
    A function to make sure that the final result of the context matrix does not
    break any assumptions/rules that are used by the portal

    Inputs:
        - subtype_tree (pandas df): The subtype tree as created by create_subtype_tree.py
        - context_matrix (pandas df): The final result of the context matrix

    Outputs: None (function will raise an error if any assert fails)
    """

    # assert that all column names are unique
    assert len(context_matrix.columns) == len(context_matrix.columns.unique())

    # assert that all nodes in the subtype tree have a corresponding column
    cm_nodes = set(context_matrix.columns)
    st_nodes = set(subtype_tree.DepmapModelType.dropna()).union(
        set(subtype_tree.MolecularSubtypeCode.dropna())
    )

    assert set.intersection(cm_nodes, st_nodes) == set.union(cm_nodes, st_nodes)


def create_context_matrix(
    model_taiga_id, molecular_subtypes_taiga_id, subtype_tree_path
):
    model_tree, subtype_tree, genetic_subtypes = load_data(
        model_taiga_id, molecular_subtypes_taiga_id, subtype_tree_path
    )

    context_matrix = construct_matrix(model_tree, subtype_tree, genetic_subtypes)

    sanity_check_results(subtype_tree, context_matrix)

    return context_matrix


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create ContextMatrix")
    parser.add_argument("model", help="Taiga ID of model table")
    parser.add_argument(
        "molecular_subtypes", help="Taiga ID of Omics Inferred Molecular Subtypes"
    )
    parser.add_argument("subtype_tree", help="Filepath for the SubtypeTree")
    parser.add_argument("output", help="filepath to write the output")
    args = parser.parse_args()

    context_matrix = create_context_matrix(
        args.model, args.molecular_subtypes, args.subtype_tree
    )

    context_matrix.to_csv(args.output)
