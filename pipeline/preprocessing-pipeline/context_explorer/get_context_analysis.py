import pandas as pd
import scipy.stats as stats
import numpy as np
import statsmodels.api as sm
import argparse
import json
import re

# need to add the preprocessing-pipeline directory to sys.path in order to import from scripts
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
from scripts.calculate_bimodality_coefficient import (
    bimodality_coefficient_for_cpd_viabilities,
)
from taigapy import create_taiga_client_v3
from tqdm import tqdm

MIN_GROUP_SIZE = 5

CRISPR_DATASET_NAME = "Chronos_Combined"
REPURPOSING_DATASET_NAME = "REPURPOSING_primary_collapsed"
ONCREF_DATASET_NAME = "PRISMOncologyReferenceLog2AUCMatrix"


def format_selectivity_vals(drug_data_dict):
    selectivity_vals_by_dataset = []
    for dataset_label, dataset in drug_data_dict.items():
        bimodality_results = (
            dataset.apply(bimodality_coefficient_for_cpd_viabilities)
            .reset_index(name="selectivity_val")
            .rename(columns={"index": "feature_id"})
            .assign(dataset=dataset_label)
        )

        selectivity_vals_by_dataset.append(bimodality_results)

    selectivity_vals = pd.concat(selectivity_vals_by_dataset)
    return selectivity_vals


### ----- LOAD DATA FROM TAIGA ----- ###


def load_crispr_data(
    tc, gene_effect_taiga_id, gene_dependency_taiga_id, tda_table_path
):
    CRISPRGeneDependency = tc.get(gene_dependency_taiga_id)
    CRISPRGeneEffect = tc.get(gene_effect_taiga_id)

    tda_table = pd.read_csv(tda_table_path)
    tda_table["gene"] = tda_table.apply(lambda x: f"{x.symbol} ({x.entrez_id})", axis=1)

    # filter CRISPR data --> Restrict analysis to genes that are dep in min. 3
    #                       cell lines and max. 95% of cell lines
    #                       Using second filter in place of Common Ess. filter
    #                       Then rescuing strongly selective genes
    n_dep_lines = (CRISPRGeneDependency > 0.5).sum()
    perc_dep_lines = (CRISPRGeneDependency > 0.5).mean()
    selective_genes = tda_table.query("CRISPR_StronglySelective == True").gene

    incl_genes = list(
        set(n_dep_lines[(n_dep_lines >= 3) & (perc_dep_lines <= 0.95)].index)
        .union(set(selective_genes))
        .intersection(set(CRISPRGeneEffect.columns))
    )

    gene_effect = CRISPRGeneEffect.loc[:, incl_genes].sort_index(axis=1)
    gene_dependency = CRISPRGeneDependency.loc[:, gene_effect.columns] > 0.5
    gene_dependency = gene_dependency.mask(CRISPRGeneDependency.isnull())

    return gene_effect, gene_dependency


def strip_brd_prefix(sample_id):
    brd_prefix_pattern = "(BRD[:-]{1})+"

    brd_prefix_match = re.search(brd_prefix_pattern, sample_id)

    if brd_prefix_match:
        new_sample_id = sample_id[brd_prefix_match.span()[1] :]
        return new_sample_id

    return sample_id


def load_SampleID_to_CompoundID_mapping(tc, portal_compounds_taiga_id):
    portal_compounds = tc.get(portal_compounds_taiga_id)
    portal_compounds["sample_id_list"] = [
        i.split(";") for i in portal_compounds.SampleIDs
    ]

    exploded_portal_compounds = portal_compounds.explode("sample_id_list")
    exploded_portal_compounds[
        "sample_id_clean"
    ] = exploded_portal_compounds.sample_id_list.apply(strip_brd_prefix)

    sample_id_to_compound_id = dict(
        zip(
            exploded_portal_compounds.sample_id_clean,
            exploded_portal_compounds.CompoundID,
        )
    )

    return sample_id_to_compound_id


def load_repurposing_data(tc, repurposing_matrix_taiga_id, portal_compounds_taiga_id):
    # construct the mapping of stripped compound sample IDs to compound IDs
    sample_id_to_compound_id_map = load_SampleID_to_CompoundID_mapping(
        tc, portal_compounds_taiga_id
    )

    repurposing_matrix_samples = tc.get(repurposing_matrix_taiga_id).T

    # strip BRD prefixes from the compound sample IDs
    repurposing_matrix_samples.columns = [
        strip_brd_prefix(i) for i in repurposing_matrix_samples.columns
    ]

    # assert that the columns are compound-sample IDs
    assert set(repurposing_matrix_samples.columns).issubset(
        sample_id_to_compound_id_map.keys()
    )

    repurposing_matrix = repurposing_matrix_samples.rename(
        columns=sample_id_to_compound_id_map
    )

    # verify that all the columns are now compound IDs
    assert set(repurposing_matrix.columns).issubset(
        sample_id_to_compound_id_map.values()
    )
    # verify that there are no duplicates per compound ID
    assert repurposing_matrix.columns.nunique() == repurposing_matrix.shape[1]

    # filter PRISM data --> Restrict analysis to drugs that are sens in min. 1
    #                       cell line and toxic to < 75% of cell lines.

    # First we have to define sensitive and non-sensitive
    repurposing_discrete = repurposing_matrix < np.log2(0.3)
    repurposing_discrete = repurposing_discrete.mask(repurposing_matrix.isnull())

    # Then define our list of valid drugs
    perc_sens_lines = repurposing_discrete.mean()
    n_sens_lines = repurposing_discrete.sum()
    incl_drugs = pd.Index(
        set(perc_sens_lines[perc_sens_lines < 0.75].index).intersection(
            set(n_sens_lines[n_sens_lines > 1].index),
        )
    )

    # Finally, filter the matrix to only the drugs that we'll test
    drug_sensitivity = repurposing_matrix.loc[:, incl_drugs]

    return drug_sensitivity


def load_oncref_data(tc, oncref_auc_taiga_id, portal_compounds_taiga_id):
    log_auc_matrix_samples = tc.get(oncref_auc_taiga_id)

    sample_id_to_compound_id_map = load_SampleID_to_CompoundID_mapping(
        tc, portal_compounds_taiga_id
    )

    # map sample IDs to compound IDs
    log_auc_matrix_compounds = log_auc_matrix_samples.rename(
        columns=sample_id_to_compound_id_map
    )

    # verify that all columns are compound IDs
    assert set(log_auc_matrix_compounds.columns).issubset(
        set(sample_id_to_compound_id_map.values())
    )
    # verify that there are no duplicates per compound ID
    assert (
        log_auc_matrix_compounds.columns.nunique() == log_auc_matrix_compounds.shape[1]
    )

    auc_matrix = 2 ** log_auc_matrix_compounds

    # verify that the NaNs are the same between the two matrices
    assert (log_auc_matrix_compounds.isna() != auc_matrix.isna()).sum().sum() == 0

    return auc_matrix, log_auc_matrix_compounds


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

    # filter to in/out group and entities with enough non-nan values
    data_subset = data.loc[in_group + out_group, ttest_entities]

    # drop entities with zero variance (ttest results will be nan)
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
    # add initial columns
    ds_res["n_dep_in"] = gene_dependency.loc[in_group].sum()
    ds_res["n_dep_out"] = gene_dependency.loc[out_group].sum()

    ds_res["n_non_dep_in"] = (gene_dependency.loc[in_group].eq(False)).sum()
    ds_res["n_non_dep_out"] = (gene_dependency.loc[out_group].eq(False)).sum()

    ds_res["frac_dep_in"] = ds_res.n_dep_in / len(in_group)
    ds_res["frac_dep_out"] = ds_res.n_dep_out / len(out_group)

    # calculate and add Odds Ratio to the selectivity_val column
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
    ds_name,
    ds,
    add_extra_columns,
    *,
    verbose=False,
):
    ds_in_group = list(set(in_group).intersection(set(ds.index.values)))
    ds_out_group = list(set(out_group).intersection(set(ds.index.values)))

    if len(ds_in_group) < MIN_GROUP_SIZE or len(ds_out_group) < MIN_GROUP_SIZE:
        if verbose:
            print(
                f"Skipping {ds_name} for {ctx} (n={len(ds_in_group)}) vs. {out_label} (n={len(ds_out_group)})"
            )
        return None

    ds_res = compute_selective_deps_for(ds_in_group, ds_out_group, ds).assign(
        subtype_code=ctx, out_group=out_label, dataset=ds_name
    )

    ds_res = add_extra_columns(ds_res, ds_in_group, ds_out_group)

    return ds_res


def compute_in_out_groups(subtype_tree, context_matrix, ds_name, ds, add_extra_columns):
    name_to_code_onco = dict(
        zip(
            subtype_tree.dropna(subset=["DepmapModelType"]).NodeName,
            subtype_tree.dropna(subset=["DepmapModelType"]).DepmapModelType,
        )
    )
    name_to_code_gs = dict(
        zip(
            subtype_tree.dropna(subset=["MolecularSubtypeCode"]).NodeName,
            subtype_tree.dropna(subset=["MolecularSubtypeCode"]).MolecularSubtypeCode,
        )
    )
    names_to_codes = {**name_to_code_onco, **name_to_code_gs}

    all_results = []

    for idx, ctx_row in tqdm(list(subtype_tree.iterrows())):
        ctx_code = names_to_codes[ctx_row.NodeName]
        ctx_in = context_matrix[context_matrix[ctx_code] == True].index

        if len(ctx_in) < MIN_GROUP_SIZE:
            continue

        # Compute vs. All Others
        ctx_out = context_matrix[context_matrix[ctx_code] != True].index
        all_results.append(
            compute_context_results(
                ctx_code, ctx_in, ctx_out, "All Others", ds_name, ds, add_extra_columns,
            )
        )

        # Compute vs. Other Heme, if applicable
        if ctx_row.Level0 in ["Myeloid", "Lymphoid"]:
            ctx_out = context_matrix[
                (context_matrix[ctx_code] != True)
                & (
                    (context_matrix["MYELOID"] == True)
                    | (context_matrix["LYMPH"] == True)
                )
            ].index
            all_results.append(
                compute_context_results(
                    ctx_code,
                    ctx_in,
                    ctx_out,
                    "Other Heme",
                    ds_name,
                    ds,
                    add_extra_columns,
                )
            )

        # Loop through all parents
        lvls_to_compare = ctx_row[
            ctx_row.index.str.contains("^Level") & (ctx_row != ctx_row.NodeName)
        ].dropna()
        for out_name in lvls_to_compare:
            out_code = names_to_codes[out_name]

            ctx_out = context_matrix[
                (context_matrix[ctx_code] != True) & (context_matrix[out_code] == True)
            ].index

            all_results.append(
                compute_context_results(
                    ctx_code, ctx_in, ctx_out, out_code, ds_name, ds, add_extra_columns,
                )
            )

    df = pd.concat([x for x in all_results if x is not None])

    return df


def get_id_or_file_name(possible_id, id_key="dataset_id"):
    return None if len(possible_id) == 0 else possible_id[0][id_key]


##### Entry points into this code. Each calc_..._enrichment function is invokable from the command line
def oncref_context_analysis(
    tc, subtype_tree, context_matrix, oncref_auc_taiga_id, portal_compounds_taiga_id
):
    # for OncRef we compute the t-test on the logged AUCs,
    # but want to set the mean_in and mean_out columns based on
    # un-logged AUCs. Therefore the un-logged AUC matrix is a
    # dataset used for "extra columns". In order to handle the
    # possibility of OncRef being None, these dataframes are in a
    # dictionary rather than expected named inputs to the
    # compute_context_results function.
    oncref_aucs, oncref_log_aucs = load_oncref_data(
        tc=tc,
        oncref_auc_taiga_id=oncref_auc_taiga_id,
        portal_compounds_taiga_id=portal_compounds_taiga_id,
    )

    datasets_to_calculate_bimodality = {ONCREF_DATASET_NAME: oncref_log_aucs}
    oncref_selectivity = format_selectivity_vals(datasets_to_calculate_bimodality)

    def prism_onc_ref_add_extra_columns(ds_res, ds_in_group, ds_out_group):
        ds_res = ds_res.copy()

        # replace mean_in, mean_out, and effect size with non-logged versions
        ds_res["mean_in"] = oncref_aucs.loc[ds_in_group].mean()
        ds_res["mean_out"] = oncref_aucs.loc[ds_out_group].mean()

        ds_res["effect_size"] = ds_res.mean_in - ds_res.mean_out

        return (
            ds_res.reset_index()
            .rename(columns={"index": "feature_id"})
            .merge(oncref_selectivity, left_on="feature_id")
        )

    return compute_in_out_groups(
        subtype_tree,
        context_matrix,
        ONCREF_DATASET_NAME,
        oncref_log_aucs,
        prism_onc_ref_add_extra_columns,
    )


def repurposing_context_analysis(
    tc,
    subtype_tree,
    context_matrix,
    repurposing_matrix_taiga_id,
    portal_compounds_taiga_id,
):
    rep_sensitivity = load_repurposing_data(
        tc=tc,
        repurposing_matrix_taiga_id=repurposing_matrix_taiga_id,
        portal_compounds_taiga_id=portal_compounds_taiga_id,
    )

    datasets_to_calculate_bimodality = {REPURPOSING_DATASET_NAME: rep_sensitivity}
    repurposing_selectivity = format_selectivity_vals(datasets_to_calculate_bimodality)

    def prism_add_extra_columns(ds_res, ds_in_group, ds_out_group):
        return (
            ds_res.reset_index()
            .rename(columns={"index": "feature_id"})
            .merge(repurposing_selectivity, left_on="feature_id")
        )

    return compute_in_out_groups(
        subtype_tree,
        context_matrix,
        REPURPOSING_DATASET_NAME,
        rep_sensitivity,
        prism_add_extra_columns,
    )


def crispr_context_analysis(
    tc,
    subtype_tree,
    context_matrix,
    gene_effect_taiga_id,
    gene_dependency_taiga_id,
    tda_table_path,
):

    gene_effect, gene_dependency = load_crispr_data(
        tc=tc,
        gene_effect_taiga_id=gene_effect_taiga_id,
        gene_dependency_taiga_id=gene_dependency_taiga_id,
        tda_table_path=tda_table_path,
    )

    def crispr_add_extra_columns(ds_res, ds_in_group, ds_out_group):
        return (
            add_crispr_columns(ds_res, gene_dependency, ds_in_group, ds_out_group,)
            .reset_index()
            .rename(columns={"index": "feature_id"})
        )

    return compute_in_out_groups(
        subtype_tree,
        context_matrix,
        CRISPR_DATASET_NAME,
        gene_effect,
        crispr_add_extra_columns,
    )


# a little glue to allow us to automatically define a command per function
def add_commands(subparsers, functions):
    from inspect import signature

    for function in functions:
        sig = signature(function)
        param_names = [
            x
            for x in sig.parameters.keys()
            if x not in ["tc", "subtype_tree", "context_matrix"]
        ]
        parser = subparsers.add_parser(function.__name__)
        parser.add_argument("subtype_tree_taiga_id")
        parser.add_argument("context_matrix_taiga_id")
        for param_name in param_names:
            parser.add_argument(param_name)
            parser.set_defaults(func=make_function_runner(function, param_names))
        parser.add_argument("out_filename")


def make_function_runner(function, param_names):
    def run_function(args):
        # shared code all functions need
        tc = create_taiga_client_v3()
        subtype_tree = tc.get(args.subtype_tree_taiga_id)
        context_matrix = tc.get(args.context_matrix_taiga_id)

        kwargs = {
            "tc": tc,
            "subtype_tree": subtype_tree,
            "context_matrix": context_matrix,
        }
        for param_name in param_names:
            kwargs[param_name] = getattr(args, param_name)

        # run the function
        results = function(**kwargs)

        # write out the outputs
        results.to_csv(args.out_filename, index=False)

    return run_function


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.set_defaults(func=None)
    subparsers = parser.add_subparsers()
    add_commands(
        subparsers,
        [
            oncref_context_analysis,
            repurposing_context_analysis,
            crispr_context_analysis,
        ],
    )

    args = parser.parse_args()
    if args.func is None:
        parser.print_help()
    else:
        args.func(args)
