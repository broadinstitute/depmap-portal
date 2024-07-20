import pandas as pd
import scipy.stats as stats
import numpy as np
import statsmodels.api as sm
import warnings
import argparse

from taigapy import create_taiga_client_v3

MIN_GROUP_SIZE = 5

### ----- LOAD DATA FROM TAIGA ----- ###
def load_models(tc, depmap_data_taiga_id):
    models = tc.get(f"{depmap_data_taiga_id}/Model")[
        ["ModelID", "StrippedCellLineName", "OncotreePrimaryDisease", "OncotreeLineage"]
    ].rename(
        columns={
            "ModelID": "model_id",
            "OncotreePrimaryDisease": "primary_disease",
            "OncotreeLineage": "lineage",
        }
    )

    return models


def load_crispr_data(tc, depmap_data_taiga_id):
    CRISPRGeneDependency = tc.get(f"{depmap_data_taiga_id}/CRISPRGeneDependency")
    CRISPRGeneEffect = tc.get(f"{depmap_data_taiga_id}/CRISPRGeneEffect")

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
    drug_discrete = Data_Matrix_Discrete.loc[:, incl_drugs].reindex()

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
    drug_discrete.drop(drop_ids, axis=1, inplace=True)

    return drug_sensitivity, drug_discrete


### ----- CONTEXT ENRICHMENT FUNCTIONS ----- ###
def compute_selective_deps_for(in_group, out_group, data, discrete_data):
    in_group = list(set(in_group).intersection(set(data.index.values)))
    out_group = list(set(out_group).intersection(set(data.index.values)))

    in_group_non_na = (
        data.loc[in_group].count().where(lambda x: x >= MIN_GROUP_SIZE).dropna()
    )
    out_group_non_na = (
        data.loc[out_group].count().where(lambda x: x >= MIN_GROUP_SIZE).dropna()
    )

    ttest_genes = sorted(
        list(set.intersection(set(in_group_non_na.index), set(out_group_non_na.index)))
    )

    data_subset = data.loc[in_group + out_group, ttest_genes]
    discrete_data_subset = discrete_data.loc[in_group + out_group, ttest_genes]

    ## Welch's t-test results
    results = pd.DataFrame(index=ttest_genes)
    results["t_pval"] = stats.ttest_ind(
        data_subset.loc[out_group, ttest_genes],
        data_subset.loc[in_group, ttest_genes],
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

    results["n_dep_in"] = (discrete_data_subset.loc[in_group]).sum()
    results["n_dep_out"] = (discrete_data_subset.loc[out_group]).sum()

    results["n_non_dep_in"] = (discrete_data_subset.loc[in_group].eq(False)).sum()
    results["n_non_dep_out"] = (discrete_data_subset.loc[out_group].eq(False)).sum()

    results["frac_dep_in"] = (discrete_data_subset.loc[in_group]).mean()
    results["frac_dep_out"] = (discrete_data_subset.loc[out_group]).mean()

    ## Odds Ratio
    or_num = np.array(results.n_non_dep_out * results.n_dep_in)
    or_denom = np.array(results.n_dep_out * results.n_non_dep_in)

    ors = np.divide(or_num, or_denom, where=or_denom != 0)

    # when the denominator is zero --> 100
    ors[or_denom == 0] = 100.0

    # when there are no dependent lines in EITHER group --> NaN
    ors[(results.n_dep_in == 0) & (results.n_dep_out == 0)] = np.nan

    results["OR"] = ors
    results["log_OR"] = [
        np.log10(i) if (i != 0) and ~(np.isnan(i)) else i for i in results.OR
    ]

    return results


### ----- CONTEXT TYPE RESULTS ----- ###
def compute_context_results(
    context,
    models,
    gene_effect,
    gene_dependency,
    drug_effect,
    drug_discrete,
    context_type="primary_disease",
):

    crispr_models = models[models.model_id.isin(gene_effect.index)]
    drug_models = models[models.model_id.isin(drug_effect.index)]
    assert (
        not drug_models.empty
    ), "Missing compound data. Make sure drug_effect is indexed by model id."

    blood_lineages = ["Myeloid", "Lymphoid"]
    solid_lineages = [
        i for i in list(models.lineage.unique()) if not i in blood_lineages
    ]

    primary_disease, lineage, lineage_types, queries = None, None, None, None
    crispr_in_group, drug_in_group = None, None
    if context_type == "primary_disease":
        # primary_disease
        primary_disease = context

        # lineage
        lineage = models.query("primary_disease==@primary_disease").lineage.unique()
        if len(lineage) > 1:
            lin_list = []
            for lin in lineage:
                if lin == None:
                    continue
                else:
                    lin_list.append(lin)

            if len(lineage) == 1:
                lineage = lin_list[0]
            else:
                lineage = lin_list
            warnings.warn(
                "More than one lineage found for %s models (using %s from %s)"
                % (primary_disease, lineage[0], ", ".join(lineage))
            )
        else:
            lineage = lineage[0]

        # lineage type (solid/heme)
        lineage_types = blood_lineages if lineage in blood_lineages else solid_lineages

        # out group queries
        queries = {
            # same lineage, but not the primary disease
            "Lineage": "primary_disease!=@primary_disease & lineage==@lineage",
            # same type (solid/heme), but not the primary disease
            "Type": "primary_disease!=@primary_disease & lineage.isin(@lineage_types)",
            # anything, but not the primary disease
            "All": "primary_disease!=@primary_disease",
        }

        # in groups
        crispr_in_group = crispr_models.query(
            "primary_disease == @primary_disease"
        ).model_id.values
        drug_in_group = drug_models.query(
            "primary_disease == @primary_disease"
        ).model_id.values

    elif context_type == "lineage":
        # lineage
        lineage = context

        # lineage type (solid/heme)
        lineage_types = blood_lineages if lineage in blood_lineages else solid_lineages

        # out group queries
        queries = {
            # same type (solid/heme), but not the lineage
            "Type": "lineage!=@lineage & lineage.isin(@lineage_types)",
            # anything, but not the lineage
            "All": "lineage!=@lineage",
        }

        # in groups
        crispr_in_group = crispr_models.query("lineage == @lineage").model_id.values
        drug_in_group = drug_models.query("lineage == @lineage").model_id.values

    context_results = []
    col_order = [
        "context_name",
        "out_group",
        "entity_id",
        "t_pval",
        "mean_in",
        "mean_out",
        "effect_size",
        "t_qval",
        "t_qval_log",
        "OR",
        "n_dep_in",
        "n_dep_out",
        "frac_dep_in",
        "frac_dep_out",
        "log_OR",
    ]
    for query_label in queries.keys():
        # GENE DEPS
        crispr_out_group = crispr_models.query(queries[query_label]).model_id.values
        if (
            len(crispr_out_group) < MIN_GROUP_SIZE
            or len(crispr_in_group) < MIN_GROUP_SIZE
        ):
            warnings.warn(
                "CRISPR group size(s) too small for %s (n=%i) vs. %s (n=%i) (%i required for both). Skipping Context."
                % (
                    context,
                    len(crispr_in_group),
                    query_label,
                    len(crispr_out_group),
                    MIN_GROUP_SIZE,
                )
            )
            pass

        else:
            crispr_results = (
                compute_selective_deps_for(
                    crispr_in_group, crispr_out_group, gene_effect, gene_dependency
                )
                .reset_index(names="entity_id")
                .assign(context_name=context, out_group=query_label)[col_order]
            )
            context_results.append(crispr_results)

        # DRUG SENSITIVITIES
        drug_out_group = drug_models.query(queries[query_label]).model_id.values
        if len(drug_out_group) < MIN_GROUP_SIZE or len(drug_in_group) < MIN_GROUP_SIZE:
            warnings.warn(
                "PRISM group size(s) too small for %s (n=%i) vs. %s (n=%i) (%i required for both). Skipping Context."
                % (
                    context,
                    len(drug_in_group),
                    query_label,
                    len(drug_out_group),
                    MIN_GROUP_SIZE,
                )
            )
            pass

        else:
            drug_results = (
                compute_selective_deps_for(
                    drug_in_group, drug_out_group, drug_effect, drug_discrete
                )
                .reset_index(names="entity_id")
                .assign(context_name=context, out_group=query_label)[col_order]
            )
            context_results.append(drug_results)

        print(f"Results computed for {context} vs {query_label}!")

    result = (
        context_results if len(context_results) == 0 else pd.concat(context_results)
    )
    return result


### ----- IDENTIFY OTHER CONTEXT DEPENDENCIES ---- ###
def identify_other_context_dependencies(
    context,
    out_group,
    entity_id,
    results_filename,
    min_fdr=0,
    max_fdr=0.05,
    min_abs_eff=0.1,
    max_abs_eff=1,
    min_frac_dep=0.1,
    max_frac_dep=1,
):
    results = pd.read_csv(results_filename)

    df = results.assign(abs_effect_size=lambda x: np.abs(x.effect_size))

    df = df[
        (df.context_name != context)
        & (df.out_group == out_group)
        & (df.entity_id == entity_id)
        & (df.t_qval >= min_fdr)
        & (df.t_qval <= max_fdr)
        & (df.abs_effect_size >= min_abs_eff)
        & (df.abs_effect_size <= max_abs_eff)
        & (df.frac_dep_in >= min_frac_dep)
        & (df.frac_dep_in <= max_frac_dep)
    ]

    return df.context_name.values


### ----- MAIN ----- ###
def compute_context_explorer_results(
    OUT_FILE,
    depmap_data_taiga_id,
    repurposing_matrix_taiga_id,
    repurposing_list_taiga_id,
):
    ### ---- LOAD DATA ---- ###
    tc = create_taiga_client_v3()

    models = load_models(tc, depmap_data_taiga_id)
    gene_effect, gene_dependency = load_crispr_data(tc, depmap_data_taiga_id)
    drug_sensitivity, drug_discrete = load_prism_data(
        tc, repurposing_matrix_taiga_id, repurposing_list_taiga_id
    )

    all_results = []
    for lineage in models.lineage.unique():
        print(lineage)
        if lineage is None:
            continue

        context_results = compute_context_results(
            lineage,
            models,
            gene_effect,
            gene_dependency,
            drug_sensitivity,
            drug_discrete,
            context_type="lineage",
        )
        if len(context_results) != 0:
            all_results.append(context_results)

    for primary_disease in models.primary_disease.unique():
        print(primary_disease)
        if primary_disease is None:
            continue
        context_results = compute_context_results(
            primary_disease,
            models,
            gene_effect,
            gene_dependency,
            drug_sensitivity,
            drug_discrete,
            context_type="primary_disease",
        )
        if len(context_results) != 0:
            all_results.append(context_results)

    assert len(all_results) > 0
    results = pd.concat(all_results)
    dummy_value = ""
    results = results.fillna(dummy_value)
    results.to_csv(OUT_FILE, index=False)

    return


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("depmap_data_taiga_id")
    parser.add_argument("repurposing_matrix_taiga_id")
    parser.add_argument("repurposing_list_taiga_id")
    parser.add_argument("out_filename")
    args = parser.parse_args()
    compute_context_explorer_results(
        args.out_filename,
        args.depmap_data_taiga_id,
        args.repurposing_matrix_taiga_id,
        args.repurposing_list_taiga_id,
    )
