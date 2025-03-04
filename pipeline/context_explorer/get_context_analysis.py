import pandas as pd
import scipy.stats as stats
import numpy as np
import statsmodels.api as sm
import warnings
import argparse

from taigapy import create_taiga_client_v3

MIN_GROUP_SIZE = 5

### ----- LOAD DATA FROM TAIGA ----- ###
def load_subtype_tree(tc, subtype_tree_taiga_id, context_matrix_taiga_id):
    subtype_tree = tc.get(subtype_tree_taiga_id)
    context_matrix = tc.get(context_matrix_taiga_id)

    return subtype_tree, context_matrix

def load_crispr_data(tc, gene_effect_taiga_id, gene_dependency_taiga_id):
    CRISPRGeneDependency = tc.get(gene_dependency_taiga_id)
    CRISPRGeneEffect = tc.get(gene_effect_taiga_id)

    # filter CRISPR data --> Restrict analysis to genes that are dep in min. 3
    #                       cell lines and NOT dependent in min. 100 lines
    #                       (Using second filter in place of Common Ess. filter)
    n_dep_lines = (CRISPRGeneDependency > 0.5).sum()
    n_non_dep_lines = (CRISPRGeneDependency <= 0.5).sum()
    incl_genes = n_dep_lines[(n_dep_lines >= 3) & (n_non_dep_lines >= 100)]
    gene_effect = CRISPRGeneEffect.loc[:, incl_genes.index]
    gene_dependency = CRISPRGeneDependency.loc[:, gene_effect.columns] > 0.5
    gene_dependency = gene_dependency.mask(CRISPRGeneDependency.isnull())

    return gene_effect, gene_dependency

def load_prism_data(tc, repurposing_matrix_taiga_id, repurposing_list_taiga_id):
    Extended_Primary_Compound_List = tc.get(repurposing_list_taiga_id)
    Extended_Primary_Data_Matrix = tc.get(repurposing_matrix_taiga_id).T
    Data_Matrix_Discrete = Extended_Primary_Data_Matrix < np.log2(0.3)
    Data_Matrix_Discrete = Data_Matrix_Discrete.mask(
        Extended_Primary_Data_Matrix.isnull()
    )

    # filter PRISM data --> Restrict analysis to drugs that are sens in min. 1
    #                       cell line and toxic to < 75% of cell lines.
    #                       Additionally, retain only the compounds tested at 2.5ul
    perc_sens_lines = Data_Matrix_Discrete.mean()
    n_sens_lines = Data_Matrix_Discrete.sum()
    incl_drugs = pd.Index(
        set(perc_sens_lines[perc_sens_lines < 0.75].index).intersection(
            set(n_sens_lines[n_sens_lines > 1].index),
            set(
                Extended_Primary_Compound_List[
                    Extended_Primary_Compound_List.dose == 2.5
                ].IDs
            ),
        )
    )

    compound_list = Extended_Primary_Compound_List[
        Extended_Primary_Compound_List.IDs.isin(incl_drugs)
    ].reindex()
    drug_sensitivity = Extended_Primary_Data_Matrix.loc[:, incl_drugs].reindex()

    # identify duplicate drug IDs (same drug and screen, but diff. batch),
    # and only keep the ID with the greatest number of finite values
    dup_idx = compound_list[["Drug.Name", "screen"]].duplicated(keep=False)
    dup = compound_list[dup_idx].sort_values("Drug.Name")
    dup_drugs = list(set(zip(dup["Drug.Name"], dup.screen)))

    drop_ids = pd.Index([])
    for drug_info in dup_drugs:
        drug_ids = compound_list[
            (compound_list["Drug.Name"] == drug_info[0])
            & (compound_list.screen == drug_info[1])
        ].IDs

        drug_drop_ids = (
            drug_sensitivity[drug_ids].count().sort_values(ascending=False).index[1:]
        )
        drop_ids = drop_ids.append(drug_drop_ids)

    drug_sensitivity.drop(drop_ids, axis=1, inplace=True)

    return drug_sensitivity

def load_oncref_data(tc, oncref_auc_taiga_id):
    auc_matrix = tc.get(oncref_auc_taiga_id)

    log_auc_matrix = np.log2(
        auc_matrix.fillna(1)
    ).mask(
        auc_matrix.isna()
    )
    
    return auc_matrix, log_auc_matrix

def format_selectivity_vals(repurposing_table,
                            oncref_table):

    #reformat repurposing compounds
    repurposing_table['entity_id'] = repurposing_table.apply(
            lambda x: f"BRD:{x.BroadID}",
            axis=1
    )
    repurposing_selectivity = repurposing_table\
                        .rename(columns={
                            'BimodalityCoefficient':'selectivity_val'
                        })[['entity_id', 'selectivity_val']]

    #reformat oncref compounds
    oncref_selectivity = oncref_table\
                        .rename(columns={
                            'BroadID':'entity_id',
                            'BimodalityCoefficient':'selectivity_val'
                        })[['entity_id', 'selectivity_val']]

    #put them all together
    selectivity_vals = pd.concat([
        repurposing_selectivity.assign(dataset='PRISMRepurposing'),
        oncref_selectivity.assign(dataset='PRISMOncRef')
    ])

    return selectivity_vals

def load_all_data(
    subtype_tree_taiga_id,
    context_matrix_taiga_id,
    gene_effect_taiga_id,
    gene_dependency_taiga_id,
    repurposing_matrix_taiga_id,
    repurposing_list_taiga_id,
    oncref_auc_taiga_id,
    repurposing_table_path,
    oncref_table_path,
    ):
    tc = create_taiga_client_v3()
    subtype_tree, context_matrix = load_subtype_tree(
        tc=tc,
        subtype_tree_taiga_id=subtype_tree_taiga_id,
        context_matrix_taiga_id=context_matrix_taiga_id
    )
    gene_effect, gene_dependency = load_crispr_data(
        tc=tc,
        gene_effect_taiga_id=gene_effect_taiga_id,
        gene_dependency_taiga_id=gene_dependency_taiga_id
    )
    rep_sensitivity = load_prism_data(
        tc=tc,
        repurposing_matrix_taiga_id=repurposing_matrix_taiga_id,
        repurposing_list_taiga_id=repurposing_list_taiga_id
    )
    oncref_aucs, oncref_log_aucs = load_oncref_data(
        tc=tc,
        oncref_auc_taiga_id=oncref_auc_taiga_id
    )

    selectivity_vals = format_selectivity_vals(
        pd.read_csv(repurposing_table_path),
        pd.read_csv(oncref_table_path)
    )

    return {
        'subtype_tree':subtype_tree,
        'context_matrix':context_matrix,
        'gene_effect': gene_effect,
        'gene_dependency':gene_dependency,
        'rep_sensitivity':rep_sensitivity,
        'oncref_log_aucs':oncref_log_aucs,
        'oncref_aucs':oncref_aucs,
        'selectivity_vals':selectivity_vals
    }

### ----- CONTEXT ENRICHMENT FUNCTIONS ----- ###
def compute_selective_deps_for(in_group, out_group, data):
    in_group = list(set(in_group).intersection(set(data.index.values)))
    out_group = list(set(out_group).intersection(set(data.index.values)))

    in_group_non_na = (
        data.loc[in_group].count().where(lambda x: x >= MIN_GROUP_SIZE).dropna()
    )
    out_group_non_na = (
        data.loc[out_group].count().where(lambda x: x >= MIN_GROUP_SIZE).dropna()
    )

    ttest_entities = sorted(
        list(set.intersection(set(in_group_non_na.index), set(out_group_non_na.index)))
    )

    #filter to in/out group and entities with enough non-nan values
    data_subset = data.loc[
                in_group + out_group,
                ttest_entities
            ]

    #drop entities with zero variance (ttest results will be nan)
    data_subset = data_subset.loc[:, data_subset.var() > 0]

    ## Welch's t-test results
    results = pd.DataFrame(index=data_subset.columns)
    results["t_pval"] = stats.ttest_ind(
        data_subset.loc[out_group, :],
        data_subset.loc[in_group, :],
        equal_var=True,
        nan_policy="omit",
    )[1]
    results = results.assign(
        t_qval=sm.stats.fdrcorrection(results.t_pval)[1],
        t_qval_log=lambda x: -np.log10(x.t_qval),
    )

    ## All other calculations
    results["mean_in"] = data_subset.loc[in_group].mean()
    results["mean_out"] = data_subset.loc[out_group].mean()
    results["effect_size"] = results.mean_in - results.mean_out

    return results

def add_crispr_columns(ds_res, gene_dependency, in_group, out_group):
    #add initial columns
    ds_res['n_dep_in'] = gene_dependency.loc[in_group].sum()
    ds_res['n_dep_out'] = gene_dependency.loc[out_group].sum()

    ds_res["n_non_dep_in"] = (gene_dependency.loc[in_group].eq(False)).sum()
    ds_res["n_non_dep_out"] = (gene_dependency.loc[out_group].eq(False)).sum()

    ds_res['frac_dep_in'] = ds_res.n_dep_in / len(in_group)
    ds_res['frac_dep_out'] = ds_res.n_dep_out / len(out_group)

    #calculate and add Odds Ratio to the selectivity_val column
    or_num = np.array(ds_res.n_non_dep_out * ds_res.n_dep_in)
    or_denom = np.array(ds_res.n_dep_out * ds_res.n_non_dep_in)

    ors = np.divide(or_num, or_denom, where=or_denom != 0)

    # when the denominator is zero --> 100
    ors[or_denom == 0] = 100.0

    # when there are no dependent lines in EITHER group --> Odds Ratio should be 1
    ors[(ds_res.n_dep_in == 0) & (ds_res.n_dep_out == 0)] = 1

    ds_res["OR"] = ors
    ds_res["selectivity_val"] = [
        np.log10(i) if (i != 0) and ~(np.isnan(i)) else i for i in ds_res.OR
    ]

    return ds_res


### ----- CONTEXT TYPE RESULTS ----- ###
def compute_context_results(
    ctx,
    in_group,
    out_group,
    out_label,
    gene_effect,
    gene_dependency,
    rep_sensitivity,
    oncref_log_aucs,
    oncref_aucs,
    selectivity_vals,
    verbose=False,
    ):

    datasets = {
        'CRISPR': gene_effect,
        'PRISMRepurposing':rep_sensitivity,
        'PRISMOncRef':oncref_log_aucs
    }

    col_order = [
        'subtype_code','out_group',
        'entity_id','dataset',
        't_pval','t_qval','t_qval_log',
        'mean_in','mean_out',
        'effect_size','selectivity_val',
        'n_dep_in', 'n_dep_out',
        'frac_dep_in', 'frac_dep_out'
    ]

    ctx_res_dfs = []
    for ds_name, ds in datasets.items():
        ds_in_group = list(set(in_group).intersection(set(ds.index.values)))
        ds_out_group = list(set(out_group).intersection(set(ds.index.values)))

        if len(ds_in_group) < MIN_GROUP_SIZE or len(ds_out_group) < MIN_GROUP_SIZE:
            if verbose: print(f'Skipping {ds_name} for {ctx} (n={len(ds_in_group)}) vs. {out_label} (n={len(ds_out_group)})')
            ctx_res_dfs.append(pd.DataFrame(columns=col_order))
            continue

        ds_res = compute_selective_deps_for(
                        ds_in_group,
                        ds_out_group,
                        ds
                    ).assign(
                        subtype_code = ctx,
                        out_group = out_label,
                        dataset=ds_name
                    )
        
        if ds_name == 'CRISPR':
            ds_res = add_crispr_columns(
                            ds_res,
                            gene_dependency,
                            ds_in_group,
                            ds_out_group
                        ).reset_index(
                            names='entity_id'
                        )
        
        elif ds_name == 'PRISMOncRef':
            #replace mean_in, mean_out, and effect size with non-logged versions
            ds_res['mean_in'] = oncref_aucs.loc[ds_in_group].mean()
            ds_res['mean_out'] = oncref_aucs.loc[ds_out_group].mean()
            ds_res['effect_size'] = ds_res.mean_in - ds_res.mean_out

        if ds_name in ['PRISMRepurposing', 'PRISMOncRef']:
            #merge with selectivity vals
            ds_res = ds_res\
                        .reset_index(names='entity_id')\
                        .merge(selectivity_vals)

        ctx_res_dfs.append(ds_res)

    return pd.concat(ctx_res_dfs)\
                .loc[:, col_order].copy()

def compute_in_out_groups(
    subtype_tree,
    context_matrix,
    gene_effect,
    gene_dependency,
    rep_sensitivity,
    oncref_log_aucs,
    oncref_aucs,
    selectivity_vals
    ):
    name_to_code_onco = dict(zip(
        subtype_tree.dropna(subset=['DepmapModelType']).NodeName,
        subtype_tree.dropna(subset=['DepmapModelType']).DepmapModelType
    ))
    name_to_code_gs = dict(zip(
        subtype_tree.dropna(subset=['MolecularSubtypeCode']).NodeName,
        subtype_tree.dropna(subset=['MolecularSubtypeCode']).MolecularSubtypeCode
    ))
    names_to_codes = {**name_to_code_onco, **name_to_code_gs}

    data_dict = {
        'gene_effect': gene_effect,
        'gene_dependency':gene_dependency,
        'rep_sensitivity':rep_sensitivity,
        'oncref_log_aucs':oncref_log_aucs,
        'oncref_aucs':oncref_aucs,
        'selectivity_vals':selectivity_vals
    }

    all_results = []
    for idx, ctx_row in subtype_tree.iterrows():
        ctx_code = names_to_codes[ctx_row.NodeName]
        ctx_in = context_matrix[context_matrix[ctx_code] == True].index

        if len(ctx_in) < MIN_GROUP_SIZE: continue

        #Compute vs. All Others
        ctx_out = context_matrix[context_matrix[ctx_code] != True].index
        all_results.append(
            compute_context_results(
                ctx_code,
                ctx_in,
                ctx_out,
                'All Others',
                **data_dict
            )
        )

        # Compute vs. Other Heme, if applicable
        if ctx_row.Level0 in ['Myeloid', 'Lymphoid']:
            ctx_out = context_matrix[
                            (context_matrix[ctx_code] != True)
                            & (
                                (context_matrix['MYELOID'] == True)
                                | (context_matrix['LYMPH'] == True)
                            )
                        ].index
            all_results.append(
                compute_context_results(
                    ctx_code,
                    ctx_in,
                    ctx_out,
                    'Other Heme',
                    **data_dict
                )
            )

        # Loop through all parents
        lvls_to_compare = ctx_row[
                                ctx_row.index.str.contains('^Level')
                                & (ctx_row != ctx_row.NodeName)
                            ].dropna()
        for out_name in lvls_to_compare:
            out_code = names_to_codes[out_name]

            ctx_out = context_matrix[
                            (context_matrix[ctx_code] != True)
                            & (context_matrix[out_code] == True)
                        ].index

            all_results.append(
                compute_context_results(
                    ctx_code,
                    ctx_in,
                    ctx_out,
                    out_code,
                    **data_dict
                )
            )

    return pd.concat(all_results)

### ----- MAIN ----- ###
def compute_context_explorer_results(
    OUT_FILE,
    subtype_tree_taiga_id,
    context_matrix_taiga_id,
    gene_effect_taiga_id,
    gene_dependency_taiga_id,
    repurposing_matrix_taiga_id,
    repurposing_list_taiga_id,
    oncref_auc_taiga_id,
    repurposing_table_path,
    oncref_table_path,
):
    ### ---- LOAD DATA ---- ###
    data_dict = load_all_data(
        subtype_tree_taiga_id,
        context_matrix_taiga_id,
        gene_effect_taiga_id,
        gene_dependency_taiga_id,
        repurposing_matrix_taiga_id,
        repurposing_list_taiga_id,
        oncref_auc_taiga_id,
        repurposing_table_path,
        oncref_table_path,
    )

    context_explorer_results = compute_in_out_groups(**data_dict)
    context_explorer_results.to_csv(OUT_FILE, index=False)

    return


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    # parser.add_argument("depmap_data_taiga_id")
    parser.add_argument("subtype_tree_taiga_id")
    parser.add_argument("context_matrix_taiga_id")
    parser.add_argument("gene_effect_taiga_id")
    parser.add_argument("gene_dependency_taiga_id")
    parser.add_argument("repurposing_matrix_taiga_id")
    parser.add_argument("repurposing_list_taiga_id")
    parser.add_argument("oncref_auc_taiga_id")
    parser.add_argument("repurposing_table")
    parser.add_argument("oncref_table")
    parser.add_argument("out_filename")
    args = parser.parse_args()

    compute_context_explorer_results(
        args.out_filename,
        args.subtype_tree_taiga_id,
        args.context_matrix_taiga_id,
        args.gene_effect_taiga_id,
        args.gene_dependency_taiga_id,
        args.repurposing_matrix_taiga_id,
        args.repurposing_list_taiga_id,
        args.oncref_auc_taiga_id,
        args.repurposing_table,
        args.oncref_table,
    )

#python3 get_context_analysis.py
#   subtypetree-919e.7/SubtypeTree
#   subtypetree-919e.7/ContextMatrix
#   internal-24q4-8c04.117/CRISPRGeneEffect
#   internal-24q4-8c04.117/CRISPRGeneDependency
#   repurposing-public-24q2-875f.4/Repurposing_Public_24Q2_Extended_Primary_Data_Matrix
#   repurposing-public-24q2-875f.4/Repurposing_Public_24Q2_Extended_Primary_Compound_List
#   internal-24q4-8c04.117/PRISMOncologyReferenceAUCMatrix
#   repurposing_table.csv
#   oncref_table.csv
#   context_analysis.csv