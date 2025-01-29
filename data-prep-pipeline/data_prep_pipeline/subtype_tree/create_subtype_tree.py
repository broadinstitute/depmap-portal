import re
import itertools
import numpy as np
import pandas as pd
from taigapy import create_taiga_client_v3

from utils import update_taiga

from datarelease_taiga_permanames import (
    context_taiga_permaname,
    subtype_tree_taiga_permaname,
    molecular_subtypes_taiga_permaname
)
from config import (
    oncotree_json_taiga_id,
    genetic_subtype_whitelist_taiga_id
)

# TODO FOR 25Q2: REMOVE THE USE OF THIS TEMPORARY MODEL FILE
temp_model_id = 'alison-test-649a.18/Model_temp_between_24q4_25q2'

### HELPER FUNCTIONS ### 
def load_data(source_dataset_id):
    tc = create_taiga_client_v3()

    ## Load the models table
    #TODO FOR 25Q2: change taiga id to be f"{source_dataset_id}/{context_taiga_permaname}"
    models = tc.get(temp_model_id)\
            .loc[:,
                ['ModelID', 'OncotreeCode', 'DepmapModelType',
                'OncotreeLineage', 'OncotreePrimaryDisease',
                'OncotreeSubtype']
            ].dropna(subset=[
                'OncotreeLineage', 'OncotreeSubtype'
            ])

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
    
    gs_whitelist = tc.get(genetic_subtype_whitelist_taiga_id)
    
    return models, oncotree, genetic_subtypes, gs_whitelist

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

    def add_non_cancerous_lineages(non_cancerous_types, oncotable):
        nc_nodes = []
        for lin in non_cancerous_types.OncotreeLineage.unique():
            if lin in oncotable.NodeName.unique(): 
                #create a Non-Cancerous node at level 1
                parent_code = oncotable[oncotable.NodeName == lin]\
                                .DepmapModelType.iloc[0]
            
                nc_nodes.append(
                            construct_new_table_node(
                                new_code=f'Z{parent_code}',
                                new_name=f"{lin} Non-Cancerous",
                                new_source='Depmap',
                                parent_code=parent_code,
                                oncotable=oncotable,
                                code_col='DepmapModelType'
                ))

            elif lin not in oncotable.NodeName.unique():
                #create a level 0 node
                lvl0_code = lin.upper().replace(' ', '_')

                #check to see if there is a code that should be used
                lvl0_test = non_cancerous_types[
                    (non_cancerous_types.OncotreeLineage == lin)
                    & (non_cancerous_types.OncotreeSubtype == lin)
                ]
                if lvl0_test.shape[0] > 0:
                     lvl0_code = lvl0_test.DepmapModelType.iloc[0]

                nc_nodes.append(
                    pd.Series({
                        'DepmapModelType':lvl0_code,
                        'NodeName':lin,
                        'NodeLevel':0,
                        'NodeSource':'Depmap',
                        'Level0':lvl0_code,
                }))

        return pd.concat([oncotable, pd.DataFrame(nc_nodes)])

    # find the types that don't exist in the oncotable
    # drop custom nodes with duplicate names or codes
    custom_nodes = models.drop(columns='ModelID')\
                    .drop_duplicates()\
                    .query(
                        '~DepmapModelType.isin(@oncotable.DepmapModelType) '\
                        '& ~OncotreeSubtype.isin(@oncotable.NodeName) '
                    ).drop_duplicates(
                        subset=['DepmapModelType'],
                        keep=False
                    ).drop_duplicates(
                        subset=['OncotreeSubtype'],
                        keep=False
                    )

    non_cancerous_types = custom_nodes.query('OncotreePrimaryDisease == "Non-Cancerous"')

    oncotable_nc = add_non_cancerous_lineages(non_cancerous_types, oncotable)

    #create and add new nodes to the oncotable
    new_nodes = []
    for idx, new_type in custom_nodes.iterrows():
        #code has already been added at lineage level
        if new_type.DepmapModelType in oncotable_nc.DepmapModelType.values: continue

        #code is a subtype, add it at a lower level
        lin_node = oncotable_nc[
                        oncotable_nc.NodeName == new_type.OncotreeLineage
                    ].iloc[0]
        
        if new_type.OncotreePrimaryDisease != 'Non-Cancerous':
            ## DECISION: Add cancerous nodes at level 1, right underneath lineage
            parent_code = lin_node.DepmapModelType
        
        elif new_type.OncotreePrimaryDisease == 'Non-Cancerous':
            if lin_node.NodeSource == 'Oncotree':
                ## DECISION: Add underneath the Non-Cancerous Level 1 node
                parent_code = 'Z'+str(lin_node.DepmapModelType)
            
            elif lin_node.NodeSource == 'Depmap':
                ## DECISION: Add at level 1, right underneath custom lineage node
                parent_code = lin_node.DepmapModelType

        new_nodes.append(
                construct_new_table_node(
                    new_code=new_type.DepmapModelType,
                    new_name=new_type.OncotreeSubtype,
                    new_source='Depmap',
                    parent_code=parent_code,
                    oncotable=oncotable_nc
                )
            )

    custom_table = pd.concat([
        oncotable_nc,
        pd.DataFrame(new_nodes)
    ])

    return custom_table

def add_disease_restricted_genetic_subtypes(gs_whitelist, subtype_tree):
    gs_nodes = []
    for idx, gs in gs_whitelist.iterrows():
        #create new node
        gs_node = construct_new_table_node(
            new_code=gs.MolecularSubtypeCode,
            new_name=f'{gs.parent_name}: {gs.subtype_name}',
            new_source='Data-driven genetic subtype',
            parent_code=gs.parent_code,
            oncotable=subtype_tree,
        )
        gs_nodes.append(gs_node)

    gs_tree = pd.DataFrame(gs_nodes)\
                .rename(columns={
                    'DepmapModelType':'MolecularSubtypeCode'
                })
    
    return pd.concat([subtype_tree, gs_tree])

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
        'OncotreeCode'
    ]

    subtype_formatted = subtype_tree_names\
                            .mask(subtype_tree.isna())\
                            .loc[:, col_order]\
                            .sort_values([
                                'Level0','Level1','Level2','Level3','Level4','Level5'
                            ])\
                            .copy()\
                            .reset_index(drop=True)

    return subtype_formatted

def sanity_check_results(subtype_tree):
    #assert that depmap codes are unique
    assert(all(subtype_tree.groupby('DepmapModelType').size() == 1))

    #assert that molecular codes are unique
    assert(all(subtype_tree.groupby('MolecularSubtypeCode').size() == 1))

    #assert there's no overlap between depmap and molecular codes
    assert(len(
        set.intersection(
            set(subtype_tree.DepmapModelType.dropna().unique()),
            set(subtype_tree.MolecularSubtypeCode.dropna().unique())    
        )
    ) == 0)

    #assert that node names are unique
    assert(all(subtype_tree.groupby('NodeName').size() == 1))


### MAIN FUNCTION ###
def create_subtype_tree(source_dataset_id, target_dataset_id):
    models, oncotree, genetic_subtypes, gs_whitelist = load_data(source_dataset_id)

    oncotable = create_oncotable(oncotree)

    oncotable_plus = add_depmap_nodes(models, oncotable)

    subtype_tree_gs = add_disease_restricted_genetic_subtypes(gs_whitelist, oncotable_plus)

    molecular_subtype_tree = create_molecular_subtype_tree(genetic_subtypes)

    all_subtypes = pd.concat([
        subtype_tree_gs.assign(TreeType = 'Lineage'),
        molecular_subtype_tree.assign(TreeType = 'MolecularSubtype')
    ])

    subtype_tree = create_subtype_tree_with_names(all_subtypes)

    # Verify results
    sanity_check_results(subtype_tree)

    # Upload results to taiga
    update_taiga(
        subtype_tree,
        "Create the SubtypeTree: A hierarchical cancer classification system "\
        "based on Oncotree and extended with custom Depmap nodes",
        target_dataset_id,
        subtype_tree_taiga_permaname,
        file_format='csv_table'
    )

    return