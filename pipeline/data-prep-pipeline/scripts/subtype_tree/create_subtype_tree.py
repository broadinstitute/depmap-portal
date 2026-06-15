import argparse
import pandas as pd
from taigapy import create_taiga_client_v3

### HELPER FUNCTIONS ###
def load_data(
    model_taiga_id,
    oncotree_taiga_id,
    molecular_subtype_tree_taiga_id,
    molecular_subtypes_taiga_id,
    genetic_subtypes_whitelist,
):
    """
    Loads and formats all of the inputs necessary to create the SubtypeTree

    Inputs:
        - taiga id's for all of the source data

    Outputs:
        - models (pandas df): The Model table with a subset of columns that are 
            relevant to the subtype tree. Here we drop models with an 
            un-annotated oncotree lineage or subtype

        - oncotree (pandas df): Oncotree as a result of calling its API and storing on taiga

        - molecular_subtype_hierarchy (pandas df): The hierarchy of molecular subtypes

        - molecular_subtypes (pandas df): Omics Inferred Molecular Subtype matrix

        - gs_whitelist (pandas df): The whitelist of custom nodes that are defined by
            a genetic subtype and will be added as a node in the lineage-based tree
    """
    tc = create_taiga_client_v3()

    ## Load the models table
    models = (
        tc.get(model_taiga_id)
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

    ## Load oncotree
    oncotree = (
        tc.get(oncotree_taiga_id)
        .rename(
            columns={
                "code": "OncotreeCode",
                "name": "NodeName",
                "tissue": "OncotreeLineage",
                "mainType": "OncotreePrimaryDisease",
                "level": "NodeLevel",
            }
        )
        .loc[
            :,
            [
                "OncotreeCode",
                "NodeName",
                "OncotreeLineage",
                "OncotreePrimaryDisease",
                "parent",
                "NodeLevel",
            ],
        ]
    )

    ## Load genetic subtypes
    mol_subtype_hierarchy = tc.get(molecular_subtype_tree_taiga_id)

    molecular_subtypes = tc.get(molecular_subtypes_taiga_id).set_index("ModelID")

    gs_whitelist = tc.get(genetic_subtypes_whitelist)

    return models, oncotree, mol_subtype_hierarchy, molecular_subtypes, gs_whitelist


def create_table_from_hierarchy(
    hierarchy_df,
    code_col='code',
    name_col='name',
    parent_col='parent',
    level_col='level',
    root_node='TISSUE'
    ):

    # define function to create table-format node
    def find_all_parents(
        node,
        hierarchy_df,
        code_col='code',
        name_col='name',
        parent_col='parent',
        root_node='TISSUE'
        ):
        # Hierarchy dataframes are indexed starting at 1, we want to index starting at 0
        cur_level = node[level_col]
        levels = dict(
            {
                "Code": node[code_col],
                "NodeName": node[name_col],
                "NodeLevel": node[level_col] - 1,  # index at 0
                f"Level{cur_level-1}": node[code_col],  # index at 0
            }
        )

        while node[parent_col] != root_node:
            # print("Current:", node[code_col])
            # print("Parent:", node[parent_col], '\n')
            node = hierarchy_df[
                hierarchy_df[code_col] == node[parent_col]
            ].iloc[0]
            cur_level = node[level_col]
            levels[f"Level{cur_level-1}"] = node[code_col]

        return pd.Series(levels)

    hierarchy_table = (
        hierarchy_df.loc[
            hierarchy_df[code_col] != root_node
        ].apply(
            find_all_parents,
            **{
                "hierarchy_df": hierarchy_df,
                "code_col":code_col,
                "name_col":name_col,
                "parent_col":parent_col,
                "root_node":root_node
            },
            axis=1
        )
    )

    # relabel duplicated node names
    dup_idx = hierarchy_table.loc[hierarchy_table.NodeName.duplicated(keep=False)].index

    hierarchy_table.loc[dup_idx, "NodeName"] = hierarchy_table.loc[dup_idx].apply(
        lambda x: f"{x.NodeName} ({x.Level0})", axis=1
    )

    return hierarchy_table


def construct_new_table_node(
    new_code, new_name, new_source, parent_code, oncotable, code_col="DepmapModelType"
):
    """
    A function to create a new custom node in the subtype tree

    Inputs:
        - new_code (str): the code to use for the new node
        - new_name (str): the name to use for the new node
        - new_source (str): the data source of the new node (e.g. Depmap)
        - parent_code (str): the code of the new node's parent
        - oncotable (pandas df): the table-version of oncotree
        - code_col (str): which code column to use to find the parent and add
            the new node's code

    Outputs:
        - new_node (pd.Series): a new custom node with all of the necessary information 
    """

    # find the node of the parent
    parent_node = oncotable[oncotable[code_col] == parent_code].iloc[0]

    # copy the parent, and add all of the new information
    new_node = parent_node.copy()

    # reset all node meta fields
    new_node["NodeLevel"] = parent_node["NodeLevel"] + 1
    new_node["NodeName"] = new_name
    new_node["NodeSource"] = new_source
    new_node[code_col] = new_code
    new_node[
        "OncotreeCode"
    ] = pd.NA  # if we are adding a custom node, there is no existing Oncotree code

    # add code to the correct level
    new_node[f"Level{new_node.NodeLevel}"] = new_code

    return new_node


def add_depmap_nodes(models, oncotable):
    """
    A function to take all custom depmap nodes and add them to the oncotable

    Inputs:
        - models (pandas df): The model table
        - oncotable (pandas df): The transformed, table-version of oncotree

    Outputs:
        - custom_table (pandas df): An extended version of the oncotable with all 
            additional nodes
    """

    def add_non_cancerous_lineages(non_cancerous_types, oncotable):
        """
        A function to ensure that all parents of the non-cancerous custom Depmap
        codes exist in the table 

        Inputs:
            - non_cancerous_types (pandas df): A subset of the model table that is
                only the codes where OncotreePrimaryDisease == "Non-Cancerous"

            - oncotable (pandas df): The transformed, table-version of oncotree

        Outputs:
            - pandas df: an extended version of the oncotable with the added 
                parent nodes of non-cancerous DepmapModelType codes
        """

        nc_nodes = []
        for lin in non_cancerous_types.OncotreeLineage.unique():
            if lin in oncotable.NodeName.unique():
                # the lineage already exists in Oncotree,
                # create a Non-Cancerous node at level 1
                parent_code = oncotable[oncotable.NodeName == lin].DepmapModelType.iloc[
                    0
                ]

                nc_nodes.append(
                    construct_new_table_node(
                        new_code=f"Z{parent_code}",  # add a Z to indicate non-cancerous
                        new_name=f"{lin} Non-Cancerous",
                        new_source="Depmap",
                        parent_code=parent_code,
                        oncotable=oncotable,
                        code_col="DepmapModelType",
                    )
                )

            elif lin not in oncotable.NodeName.unique():
                # the lineage does not exist in Oncotree.
                # In this case, we add the lineage as a Level 0, and
                # the Non-Cancerous subtypes will be added at Level 1

                # create a level 0 node
                lvl0_code = lin.upper().replace(" ", "_")

                # check to see if there is a code that should be used
                # criteria is if Lineage == Subtype
                lvl0_test = non_cancerous_types[
                    (non_cancerous_types.OncotreeLineage == lin)
                    & (non_cancerous_types.OncotreeSubtype == lin)
                ]
                if lvl0_test.shape[0] > 0:
                    lvl0_code = lvl0_test.DepmapModelType.iloc[0]

                nc_nodes.append(
                    pd.Series(
                        {
                            "DepmapModelType": lvl0_code,
                            "NodeName": lin,
                            "NodeLevel": 0,
                            "NodeSource": "Depmap",
                            "Level0": lvl0_code,
                        }
                    )
                )

        return pd.concat([oncotable, pd.DataFrame(nc_nodes)])

    # find the types that don't exist in the oncotable
    # drop nodes with duplicate names or codes
    # In theory, sanity checks on gumbo will prevent anything from being dropped anyways
    custom_nodes = (
        models.drop(columns="ModelID")
        .drop_duplicates()
        .query(
            "~DepmapModelType.isin(@oncotable.DepmapModelType) "
            "& ~OncotreeSubtype.isin(@oncotable.NodeName) "
        )
        .drop_duplicates(subset=["DepmapModelType"], keep=False)
        .drop_duplicates(subset=["OncotreeSubtype"], keep=False)
    )

    # identify all of the non-cancerous types (these are special case)
    non_cancerous_types = custom_nodes.query(
        'OncotreePrimaryDisease == "Non-Cancerous"'
    )

    # for all lineages of non-cancerous types, either
    #   1. add the lineage if it doesn't already exist, or
    #   2. add a Non-Cancerous level 1 node if the lineage does exist
    oncotable_nc = add_non_cancerous_lineages(non_cancerous_types, oncotable)

    # create and add new nodes to the oncotable
    new_nodes = []
    for idx, new_type in custom_nodes.iterrows():
        # code has already been added at lineage level
        if new_type.DepmapModelType in oncotable_nc.DepmapModelType.values:
            continue

        # code is a subtype, add it at a lower level
        lin_node = oncotable_nc[oncotable_nc.NodeName == new_type.OncotreeLineage].iloc[
            0
        ]

        if new_type.OncotreePrimaryDisease != "Non-Cancerous":
            ## DECISION: Add cancerous nodes at level 1, right underneath lineage
            parent_code = lin_node.DepmapModelType

            ## Hard-coded PedDep request for 25Q2: Add BALL and TALL under Lymphoid Neoplasm
            if new_type.DepmapModelType in ["BALL", "TALL"]:
                parent_code = "LNM"

        elif new_type.OncotreePrimaryDisease == "Non-Cancerous":
            if lin_node.NodeSource == "Oncotree":
                ## DECISION: Add underneath the Non-Cancerous Level 1 node
                parent_code = "Z" + str(lin_node.DepmapModelType)

            elif lin_node.NodeSource == "Depmap":
                ## DECISION: Add at level 1, right underneath custom lineage node
                parent_code = lin_node.DepmapModelType

        new_nodes.append(
            construct_new_table_node(
                new_code=new_type.DepmapModelType,
                new_name=new_type.OncotreeSubtype,
                new_source="Depmap",
                parent_code=parent_code,
                oncotable=oncotable_nc,
            )
        )

    custom_table = pd.concat([oncotable_nc, pd.DataFrame(new_nodes)])

    return custom_table


def add_disease_restricted_genetic_subtypes(gs_whitelist, subtype_tree):
    """
    A function to add the white-listed genetic subtypes to the lineage-based tree

    Inputs:
        - gs_whitelist (pandas df): A table of custom genetic subtypes to add
        - subtype_tree (pandas df): The subtype tree table

    Outputs:
        - An extended version of the subtype tree with the additional genetic
            subtype nodes
    """
    gs_nodes = []
    for idx, gs in gs_whitelist.iterrows():
        # create new node
        gs_node = construct_new_table_node(
            new_code=gs.MolecularSubtypeCode,
            new_name=f"{gs.parent_name}: {gs.subtype_name}",
            new_source="Data-driven genetic subtype",
            parent_code=gs.parent_code,
            oncotable=subtype_tree,
        )
        gs_nodes.append(gs_node)

    # the code is a data-driven Molecular Subtype, and does not
    # originate from gumbo or any other annotation
    gs_tree = pd.DataFrame(gs_nodes).rename(
        columns={"DepmapModelType": "MolecularSubtypeCode"}
    )

    return pd.concat([subtype_tree, gs_tree])

def create_subtype_tree_with_names(subtype_tree):
    """
    A function to convert the subtype tree which uses all codes to the subtype
    tree which uses all names

    Inputs:
        - subtype_tree (pandas df): Here it assumes that all values in the "Level{i}"
            columns are codes (Oncotree codes or custom Depmap codes)

    Outputs:
        - subtype_formatted (pandas df): A copy of the subtype tree where all
            values in the "Level{i}" columns are the names of the nodes, rather
            than codes
    """

    # create a mapping of codes to names
    onco_to_name = dict(zip(subtype_tree.DepmapModelType, subtype_tree.NodeName))
    gs_to_name = dict(zip(subtype_tree.MolecularSubtypeCode, subtype_tree.NodeName))
    codes_to_names = {**onco_to_name, **gs_to_name}

    # force nans to be nans
    codes_to_names[pd.NA] = pd.NA

    # copy the subtype tree and map all level columns to the names
    subtype_tree_names = subtype_tree.copy()
    for col in [i for i in subtype_tree.columns if i.startswith("Level")]:
        subtype_tree_names[col] = subtype_tree_names[col].map(codes_to_names)

    col_order = [
        "DepmapModelType",
        "MolecularSubtypeCode",
        "NodeName",
        "NodeLevel",
        "NodeSource",
        "TreeType",
        "Level0",
        "Level1",
        "Level2",
        "Level3",
        "Level4",
        "Level5",
        "OncotreeCode",
    ]

    # mask with NaNs in the correct places, order the columns, and sort the values
    subtype_formatted = (
        subtype_tree_names.mask(subtype_tree.isna())
        .loc[:, col_order]
        .sort_values(["Level0", "Level1", "Level2", "Level3", "Level4", "Level5"])
        .copy()
        .reset_index(drop=True)
    )

    return subtype_formatted


def sanity_check_results(subtype_tree, molecular_subtypes):
    """
    A function to make sure that the final result of the subtype tree does not
    break any assumptions/rules that are used by the portal

    Inputs:
        - subtype_tree (pandas df): The final result of the subtype tree

    Outputs: None (function will raise an error if any assert fails)
    """

    # assert that depmap codes are unique
    assert all(subtype_tree.groupby("DepmapModelType").size() == 1)

    # assert that molecular codes are unique
    assert all(subtype_tree.groupby("MolecularSubtypeCode").size() == 1)

    # assert there's no overlap between depmap and molecular codes
    assert (
        len(
            set.intersection(
                set(subtype_tree.DepmapModelType.dropna().unique()),
                set(subtype_tree.MolecularSubtypeCode.dropna().unique()),
            )
        )
        == 0
    )

    # assert that node names are unique
    assert all(subtype_tree.groupby("NodeName").size() == 1)

    # assert that all columns in the OmicsInferredMolecularSubtype Matrix have
    # a node in the tree
    assert (
        set(
            molecular_subtypes.columns
        ).issubset(set(
            subtype_tree.NodeName.values
        ))
    )


### MAIN FUNCTION ###
def create_subtype_tree(
    model_taiga_id,
    oncotree_taiga_id,
    molecular_subtype_tree_taiga_id,
    molecular_subtypes_taiga_id,
    genetic_subtypes_whitelist,
):
    models, oncotree, mol_subtype_hierarchy, molecular_subtypes, gs_whitelist = load_data(
        model_taiga_id,
        oncotree_taiga_id,
        molecular_subtype_tree_taiga_id,
        molecular_subtypes_taiga_id,
        genetic_subtypes_whitelist,
    )

    oncotable = create_table_from_hierarchy(
        oncotree,
        code_col='OncotreeCode',
        name_col='NodeName',
        level_col='NodeLevel'
    ).rename(columns={
        'Code':'OncotreeCode'
    }).assign(
        DepmapModelType=lambda x: x.OncotreeCode,
        NodeSource="Oncotree"
    )

    oncotable_plus = add_depmap_nodes(models, oncotable)

    subtype_tree_gs = add_disease_restricted_genetic_subtypes(
        gs_whitelist, oncotable_plus
    )

    molecular_subtype_tree = create_table_from_hierarchy(
        mol_subtype_hierarchy,
        code_col='MolecularSubtypeCode',
        name_col='NodeName',
        root_node='MOLSUBTYPES_ROOT'
    ).rename(columns={
        'Code':'MolecularSubtypeCode'
    }).assign(
        NodeSource="Omics Inferred Molecular Subtype"
    )

    all_subtypes = pd.concat(
        [
            subtype_tree_gs.assign(TreeType="Lineage"),
            molecular_subtype_tree.assign(TreeType="MolecularSubtype"),
        ]
    )

    subtype_tree = create_subtype_tree_with_names(all_subtypes)

    # Verify results
    sanity_check_results(subtype_tree, molecular_subtypes)

    return subtype_tree


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create SubtypeTree")
    parser.add_argument("model", help="Taiga ID of model table")
    parser.add_argument("oncotree", help="Taiga ID of oncotree")
    parser.add_argument(
        "molecular_subtypes_hierarchy", help="Taiga ID of Molecular Subtype Hierarchy"
    )
    parser.add_argument(
        "molecular_subtypes", help="Taiga ID of OmicsInferredMolecularSubtype Matrix"
    )
    parser.add_argument(
        "genetic_subtypes_whitelist",
        help="Taiga ID of lineage-based genetic subtype whitelist",
    )
    parser.add_argument("output", help="filepath to write the output")
    args = parser.parse_args()

    subtype_tree = create_subtype_tree(
        args.model,
        args.oncotree,
        args.molecular_subtypes_hierarchy,
        args.molecular_subtypes,
        args.genetic_subtypes_whitelist,
    )

    subtype_tree.to_csv(args.output, index=False)
