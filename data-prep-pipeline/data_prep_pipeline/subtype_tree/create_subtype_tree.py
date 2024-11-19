import numpy as np
import pandas as pd
from taigapy import create_taiga_client_v3

from datarelease_taiga_permanames import (
    context_taiga_permaname,
    subtype_tree_taiga_permaname
)
from config import oncotree_json_taiga_id
from utils import update_taiga


def load_data(source_dataset_id,
              context_taiga_permaname,
              oncotree_json_taiga_id):
    tc = create_taiga_client_v3()

    ## Load the models table
    models = tc.get(f"{source_dataset_id}/{context_taiga_permaname}")\
            .loc[:,
                ['ModelID', 'OncotreeCode', 'DepmapModelType',
                'OncotreeLineage', 'OncotreePrimaryDisease',
                'OncotreeSubtype']
            ]

    ## Load oncotree
    oncotree = tc.get(oncotree_json_taiga_id)\
                    .rename(
                        columns={
                            'code':'OncotreeCode',
                            'name':'NodeName',
                            'tissue':'OncotreeLineage',
                            'mainType':'OncotreePrimaryDisease',
                            'level':'NodeLevel'
                        }
                    ).loc[:,
                        ['OncotreeCode', 'NodeName', 'OncotreeLineage',
                        'OncotreePrimaryDisease', 'parent', 'NodeLevel']
                    ]
    
    return models, oncotree


def create_oncotable(oncotree):

    #define function to create table-format node
    def find_all_parents(node, oncotree):    
        cur_level = node.NodeLevel
        levels = dict({
                    'OncotreeCode':node.OncotreeCode,
                    'NodeName':node.NodeName,
                    'NodeLevel':node.NodeLevel-1, #we want to index at 0
                    f'Level{cur_level-1}':node.OncotreeCode
                })

        while node.parent != 'TISSUE':
            node = oncotree.query('OncotreeCode == @node.parent').iloc[0]
            cur_level = node.NodeLevel
            levels[f"Level{cur_level-1}"] = node['OncotreeCode']
        
        return pd.Series(levels)

    oncotable = oncotree[oncotree.OncotreeCode != 'TISSUE']\
                    .apply(
                        find_all_parents,
                        **{'oncotree':oncotree},
                        axis=1
                    ).assign(
                        DepmapModelType = lambda x: x.OncotreeCode
                    )
    
    return oncotable


def add_depmap_nodes(models, oncotable):

    #define function to create the new custom node
    def construct_new_table_node(new_depmap_type, oncotable):
        ## DECISION: Add all custom nodes at level 1, right underneath lineage
        parent_code = oncotable[
                        oncotable.NodeName == new_depmap_type.OncotreeLineage
                    ].OncotreeCode.iloc[0]
        new_depmap_node = pd.Series({
            'Level0':parent_code,
            'Level1':new_depmap_type.DepmapModelType,
            'NodeLevel':1,
            'NodeName':new_depmap_type.OncotreeSubtype,
            'OncotreeCode':np.nan,
            'DepmapModelType':new_depmap_type.DepmapModelType
        })

        return new_depmap_node

    #identify nodes to add
    custom_nodes = models.drop(columns='ModelID')\
                         .drop_duplicates()\
                         .query('DepmapModelType != OncotreeCode '\
                              '& OncotreePrimaryDisease != "Non-Cancerous" '\
                              '& ~DepmapModelType.isin(["HSP", "PROC"])')

    #create and add new nodes to the oncotable
    custom_table = oncotable.copy()
    for idx, new_type in custom_nodes.iterrows():
        custom_table.loc[
            custom_table.shape[0]
        ] = construct_new_table_node(new_type, oncotable)

    return custom_table


def move_branch_up(node_to_collapse, subtype_tree):
    #identify old branch of the tree
    branch = subtype_tree[
                subtype_tree[node_to_collapse.new_node_level] == node_to_collapse.NodeAliasCode
            ]
    
    #create column mapping for those that need to move up
    col_renaming = dict(zip(
        [f'Level{i}' for i in range(int(node_to_collapse.old_node_level[-1]), 6)], #old column names
        [f'Level{i}' for i in range(int(node_to_collapse.new_node_level[-1]), 5)] #new column names
    ))

    #drop old parent node and parent columns
    new_branch = branch\
                    [branch.DepmapModelType != node_to_collapse.NodeAliasCode]\
                    .drop(
                        columns=node_to_collapse.new_node_level
                    ).rename(
                        columns=col_renaming
                    )
    
    if not('NodeAliasCode' in new_branch.columns):
        new_branch = new_branch.assign(
                        NodeAliasCode = np.nan
                    ).astype('object')
    
    #move all nodes up one level in their NodeLevel annotation
    new_branch['NodeLevel'] = new_branch.NodeLevel - 1

    #drop the old branch
    subtype_tree = subtype_tree.drop(branch.index)

    #add new branch back in
    subtype_tree = pd.concat([subtype_tree, new_branch])\
                    .sort_values([f"Level{i}" for i in range(6)])\
                    .reset_index(drop=True)

    return subtype_tree


def remove_level1_node(node_to_collapse, subtype_tree):
    #add alias column the Level0 node
    subtype_tree.loc[
        subtype_tree.DepmapModelType == node_to_collapse.NodeAliasCode,
        'NodeAliasCode'
    ] = node_to_collapse.DepmapModelType

    #find every child of the level 1 node
    lvl2s = subtype_tree[
                (subtype_tree.Level1 == node_to_collapse.DepmapModelType)
                & (~subtype_tree.Level2.isna())
            ].Level2.unique()
    
    lvl2_mappings = pd.DataFrame({
        'NodeAliasCode':node_to_collapse.DepmapModelType,
        'DepmapModelType':lvl2s,
        'old_node_level':'Level2',
        'new_node_level':'Level1'
    })

    for idx, lvl2_collapse in lvl2_mappings.iterrows():
        #move the new branch up one level
        subtype_tree = move_branch_up(lvl2_collapse, subtype_tree)

    return subtype_tree


def search_and_collapse_at_level(lvl, model_tree, subtype_tree):

    #define function to determine if parent-child nodes should be collapsed
    def determine_collapse(df, parent_lvl, child_lvl):
        children = df[[parent_lvl, child_lvl]].drop_duplicates()
        if children.shape[0]==1 and not pd.isnull(children[child_lvl].iloc[0]):
            return pd.Series({
                'DepmapModelType':children[child_lvl].iloc[0]
            })
    
    cur_lvl = f'Level{lvl}'
    child_lvl = f'Level{lvl+1}'

    #use custom function to find nodes to collapse
    mapping = model_tree\
                .groupby(cur_lvl)\
                [[cur_lvl, child_lvl]]\
                .apply(
                    determine_collapse, 
                    **{'parent_lvl':cur_lvl,
                        'child_lvl':child_lvl}
                ).dropna()\
                .reset_index(names='NodeAliasCode')\
                .assign(
                            old_node_level=child_lvl,
                            new_node_level=cur_lvl
                )
    
    #iterate through list of nodes and collapse those branches
    for idx, node_to_collapse in mapping.iterrows():
        #different process if we are checking between L0 and L1
        if lvl == 0:
            #verify that there are no models with the code we are removing
            n_mod = model_tree.loc[
                        model_tree.DepmapModelType == node_to_collapse.DepmapModelType
                    ].shape[0]
            if n_mod > 0: continue

            subtype_tree = remove_level1_node(node_to_collapse, subtype_tree)

        elif lvl > 0:
            #verify that there are no models with the code we are removing
            n_mod = model_tree.loc[
                        model_tree.DepmapModelType == node_to_collapse.NodeAliasCode
                    ].shape[0]
            if n_mod > 0: continue

            #move the new branch up one level
            subtype_tree = move_branch_up(node_to_collapse, subtype_tree)
            
            #add alias column for the removed node
            subtype_tree.loc[
                subtype_tree.DepmapModelType == node_to_collapse.DepmapModelType,
                'NodeAliasCode'
            ] = node_to_collapse.NodeAliasCode

    return subtype_tree


def collapse_parent_child_nodes(models, oncotable_plus):
    model_tree = models.loc[:,
                            ['ModelID', 'OncotreeCode', 'DepmapModelType']
                        ].merge(oncotable_plus)
        
    # filter the tree/table to only include contexts that exist in our model table
    #   more complex than just filtering on DepmapModelType codes, because that
    #   will drop Level0's and Level1's that we want in the table
    max_lvl = max([int(i[-1]) for i in oncotable_plus.columns if i.startswith('Level')])

    filter_query = []
    for i in range(max_lvl+1):
        #Level0 and Level1 need to manually add nan to the list of values
        if i <= 1:
            filter_query.append(
                f'(Level{i}.isin(@model_tree.Level{i}) | Level{i}.isna())'
            )
        else:
            filter_query.append(
                f'Level{i}.isin(@model_tree.Level{i})'
            )
    filter_query = ' & '.join(filter_query)

    subtype_tree = oncotable_plus.query(filter_query).copy()
    
    code_to_name = dict(zip(oncotable_plus.DepmapModelType, oncotable_plus.NodeName))
    
    # for each parent level, search for children that can be moved up
    for lvl in reversed(range(max_lvl)):
        subtype_tree = search_and_collapse_at_level(
                            lvl,
                            model_tree,
                            subtype_tree
                        )

    subtype_tree['NodeAliasName'] = subtype_tree.NodeAliasCode.map(code_to_name)    
    return subtype_tree


def create_subtype_tree_with_names(subtype_tree):
    codes_to_names = dict(zip(subtype_tree.OncotreeCode, subtype_tree.NodeName))

    subtype_tree_names = subtype_tree.copy()
    for col in [i for i in subtype_tree.columns if i.startswith('Level')]:
        subtype_tree_names[col] = subtype_tree_names[col].map(codes_to_names)

    return subtype_tree_names


def create_subtype_tree(source_dataset_id, target_dataset_id):

    models, oncotree = load_data(
                            source_dataset_id,
                            context_taiga_permaname,
                            oncotree_json_taiga_id
                        )

    oncotable = create_oncotable(oncotree)

    oncotable_plus = add_depmap_nodes(models, oncotable)

    subtype_tree = collapse_parent_child_nodes(models, oncotable_plus)

    subtype_tree_names = create_subtype_tree_with_names(subtype_tree)

    #SAVE CODE VERSION AS CSV FOR INTERNAL USE
    #TODO: CHECK WITH NAYEEM THAT THIS WILL WORK/WHERE TO SAVE

    #UPLOAD NAME VERSION TO TAIGA
    update_taiga(
        subtype_tree_names,
        "Create SubtypeTree for Depmap Context Hierarchy",
        target_dataset_id,
        subtype_tree_taiga_permaname,
        file_format='csv_table'
    )

    return