import re
import itertools
import numpy as np
import pandas as pd
from taigapy import create_taiga_client_v3

from datarelease_taiga_permanames import (
    context_taiga_permaname,
    subtype_tree_taiga_permaname,
    molecular_subtypes_taiga_permaname
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
    
    ## Load genetic subtypes
    genetic_subtypes = tc.get(f"{source_dataset_id}/{molecular_subtypes_taiga_permaname}")\
                            .set_index('ModelID')
    
    return models, oncotree, genetic_subtypes


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
                        DepmapModelType = lambda x: x.OncotreeCode,
                        NodeSource = "Oncotree"
                    )
    
    #relabel duplicated node names
    dup_idx = oncotable.loc[oncotable.NodeName.duplicated(keep=False)].index

    oncotable.loc[dup_idx, 'NodeName'] = oncotable.loc[dup_idx].apply(
        lambda x: f"{x.NodeName} ({x.Level0})",
        axis=1
    )
    
    return oncotable


def construct_new_table_node(new_code,
                            new_name,
                            new_source,
                            parent_code,
                            oncotable,
                            code_col='DepmapModelType'):
    parent_node = oncotable[oncotable[code_col] == parent_code].iloc[0]

    new_node = parent_node.copy()

    #reset all node meta fields
    new_node['NodeLevel'] = parent_node['NodeLevel'] + 1
    new_node['NodeName'] = new_name
    new_node['NodeSource'] = new_source
    new_node[code_col] = new_code
    new_node['OncotreeCode'] = np.nan

    #add code to the correct level
    new_node[f"Level{new_node.NodeLevel}"] = new_code

    return new_node


def add_depmap_nodes(models, oncotable):
    #identify nodes to add
    custom_nodes = models.drop(columns='ModelID')\
                         .drop_duplicates()\
                         .query('DepmapModelType != OncotreeCode '\
                              '& OncotreePrimaryDisease != "Non-Cancerous" '\
                              '& ~DepmapModelType.isin(["HSP", "PROC"])')

    #create and add new nodes to the oncotable
    new_nodes = []
    for idx, new_type in custom_nodes.iterrows():
        parent_code = oncotable[oncotable.NodeName == new_type.OncotreeLineage]\
                        .DepmapModelType.iloc[0]
        new_nodes.append(
            construct_new_table_node(
                new_code=new_type.DepmapModelType,
                new_name=new_type.OncotreeSubtype,
                new_source='Depmap',
                ## DECISION: Add all custom nodes at level 1, right underneath lineage
                parent_code=parent_code,
                oncotable=oncotable
            )
        )

    custom_table = pd.concat([
        oncotable,
        pd.DataFrame(new_nodes)
    ])

    return custom_table


def create_disease_restricted_genetic_node(subtype,
                                           model_tree,
                                           genetic_subtypes,
                                           subtype_tree,
                                           perc_threshold=0.8):
    ## find the models with that molecular subtype & their oncotree information
    subtype_model_ids = genetic_subtypes[genetic_subtypes[subtype]==True].index
    subtype_models = model_tree[model_tree.ModelID.isin(subtype_model_ids)]

    ## for each level, find the most common disease type for the subtype models
    st_vals = pd.DataFrame(columns=['level', 'top_node', 'n_models'])
    for i in range(6):
        lvl_vals = subtype_models[f'Level{i}']\
                    .value_counts().nlargest(1)\
                    .to_frame(name='n_models')\
                    .reset_index(names='top_node')\
                    .assign(level=f'Level{i}')
        
        #skip over levels where all models have nan as the annotation
        if lvl_vals.shape[0] > 0:
            st_vals = pd.concat([
                st_vals,
                lvl_vals
            ])

    #calculate the percentage of subtype models that are this top disease type
    st_vals['perc_models'] = st_vals.n_models / len(subtype_model_ids)

    #determine if any of the disease types pass our percentage threshold
    dis_restricted = st_vals[st_vals.perc_models >= perc_threshold]

    #it is disease-type restricted! add the new node
    if dis_restricted.shape[0] > 0:
        #find the lowest level where it is disease-type restricted
        parent = dis_restricted.sort_values('level').iloc[-1]
        parent_name = subtype_tree[subtype_tree.DepmapModelType == parent.top_node]\
                        .NodeName.iloc[0]
        
        #construct a new node
        new_node = construct_new_table_node(
            new_code=f"{parent.top_node}: {subtype}".replace(' ', ''),
            new_name=f"{parent_name}: {subtype}",
            new_source="Data-driven genetic subtype",
            parent_code=parent.top_node,
            oncotable=subtype_tree
        )
        #DepmapModelType should be null --> reassign value to new column
        new_node['MolecularSubtypeCode'] = new_node.DepmapModelType
        new_node['DepmapModelType'] = np.nan
        
        return new_node
    
    #it is not disease-type restricted, do not create a new node
    else:
        return None
    

def add_disease_restricted_genetic_subtypes(genetic_subtypes,
                                            models,
                                            subtype_tree):
    model_tree = models.loc[:,['ModelID', 'DepmapModelType']]\
                    .merge(subtype_tree)

    subtype_tree['MolecularSubtypeCode'] = np.nan
    for subtype in list(genetic_subtypes.columns):
        new_node = create_disease_restricted_genetic_node(
                        subtype,
                        model_tree,
                        genetic_subtypes,
                        subtype_tree
                    )
        if new_node is not None:
            subtype_tree.loc[subtype_tree.shape[0]] = new_node

    return subtype_tree


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
                .reset_index(
                    names='NodeAliasCode'
                ).assign(
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


def add_molecular_subtype_subtree(df, mst_tree):
    oims = 'Omics Inferred Molecular Subtype'
    
    df = df.sort_values(
            'full_st'
        ).assign(
            level=1,
            parent=df.gene.values[0]
        )

    #find all nodes that are children of another
    pairwise_st = itertools.combinations(df.full_st, 2)
    for pair in pairwise_st:
        #if the first one is a parent of the second
        if re.search(pair[0], pair[1]):
            #set level to be one below the parent
            df.loc[
                df.full_st == pair[1], 'level'
            ] = df.loc[df.full_st == pair[0], 'level'].values[0] + 1
            
            #set the parent value
            df.loc[df.full_st == pair[1], 'parent'] = pair[0]
        
        #if the second is a parent of the first
        elif re.search(pair[1], pair[0]):
            #set level to be one below the parent
            df.loc[
                df.full_st == pair[0], 'level'
            ] = df.loc[df.full_st == pair[1], 'level'].values[0] + 1
            
            #set the parent value
            df.loc[df.full_st == pair[0], 'parent'] = pair[1]

    #then construct new nodes of the table   
    for idx, row in df.sort_values('level').iterrows():
        mst_tree.loc[mst_tree.shape[0]] = construct_new_table_node(
            new_code=row.full_st.replace(' ', ''),
            new_name=row.full_st,
            new_source=oims,
            parent_code=row.parent.replace(' ', ''),
            oncotable=mst_tree,
            code_col='MolecularSubtypeCode'
        )

    return mst_tree


def create_molecular_subtype_tree(genetic_subtypes):
    #determine how many subtypes are associated with each gene
    gene_st = pd.DataFrame(
            [re.split(" |-", i, maxsplit=1) for i in genetic_subtypes.columns],
            columns=['gene', 'subtype']
        ).assign(
            full_st = genetic_subtypes.columns
        )
    gene_st['n_gene'] = gene_st.groupby('gene').transform('size')

    #create the level 0 nodes
    single_genes = gene_st[gene_st.n_gene == 1]
    mult_genes = gene_st[gene_st.n_gene > 1]
    oims = 'Omics Inferred Molecular Subtype'

    top_nodes = []
    for full_st in single_genes.full_st:
        #for genes with only one subtype, add the full subtype to level 0
        new_node = pd.Series({
            'MolecularSubtypeCode':full_st.replace(' ',''),
            'NodeName':full_st,
            'NodeLevel':0,
            'NodeSource':oims,
            'Level0':full_st.replace(' ','')
        })
        top_nodes.append(new_node)

    for gene in mult_genes.gene.unique():
        #for genes with multiple subtypes, add just the gene name to level0
        new_node = pd.Series({
            'MolecularSubtypeCode':gene,
            'NodeName':gene,
            'NodeLevel':0,
            'NodeSource':oims,
            'Level0':gene
        })
        top_nodes.append(new_node)

    #turn top level nodes into a dataframe
    mst_tree = pd.DataFrame(top_nodes)\
                .assign(
                    Level1=np.nan,
                    Level2=np.nan,
                    Level3=np.nan,
                    Level4=np.nan,
                    Level5=np.nan
                )

    #now for each gene with multiple subtypes, construct and add the subtree
    for gene in mult_genes.gene.unique():
        mst_tree = add_molecular_subtype_subtree(
            gene_st[gene_st.gene == gene],
            mst_tree
        )

    return mst_tree


def create_subtype_tree_with_names(subtype_tree):
    onco_to_name = dict(zip(subtype_tree.DepmapModelType, subtype_tree.NodeName))
    gs_to_name = dict(zip(subtype_tree.MolecularSubtypeCode, subtype_tree.NodeName))
    codes_to_names = {**onco_to_name, **gs_to_name}
    
    #force nans to be nans
    codes_to_names[np.nan] = np.nan

    subtype_tree_names = subtype_tree.copy()
    for col in [i for i in subtype_tree.columns if i.startswith('Level')]:
        subtype_tree_names[col] = subtype_tree_names[col].map(codes_to_names)

    col_order = [
        'DepmapModelType','MolecularSubtypeCode','NodeName','NodeLevel','NodeSource',
        'TreeType','Level0','Level1','Level2','Level3','Level4','Level5',
        'OncotreeCode','NodeAliasCode','NodeAliasName'
    ]

    subtype_formatted = subtype_tree_names\
                            .mask(subtype_tree.isna())\
                            .loc[:, col_order]\
                            .sort_values([
                                'Level0','Level1','Level2','Level3','Level4','Level5'
                            ])\
                            .copy()

    return subtype_formatted


def create_subtype_tree(source_dataset_id, target_dataset_id):

    models, oncotree, genetic_subtypes = load_data(
                                source_dataset_id,
                                context_taiga_permaname,
                                oncotree_json_taiga_id
                            )

    oncotable = create_oncotable(oncotree)

    oncotable_plus = add_depmap_nodes(models, oncotable)

    subtype_tree_codes = collapse_parent_child_nodes(models, oncotable_plus)

    subtype_tree_gs = add_disease_restricted_genetic_subtypes(
                                genetic_subtypes,
                                models,
                                subtype_tree_codes
                            )

    molecular_subtype_tree = create_molecular_subtype_tree(genetic_subtypes)

    all_subtypes = pd.concat([
        subtype_tree_gs.assign(TreeType = 'Lineage'),
        molecular_subtype_tree.assign(TreeType = 'MolecularSubtype')
    ])

    subtype_tree = create_subtype_tree_with_names(all_subtypes)

    #UPLOAD NAME VERSION TO TAIGA
    update_taiga(
        subtype_tree,
        "Create SubtypeTree for Depmap Lineage-based Context Hierarchy",
        target_dataset_id,
        subtype_tree_taiga_permaname,
        file_format='csv_table'
    )

    return