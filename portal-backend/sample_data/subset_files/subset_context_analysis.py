import pandas as pd
import scipy.stats as stats
import numpy as np
import statsmodels.api as sm
import os
import warnings

from taigapy import create_taiga_client_v3

MIN_GROUP_SIZE = 5
depmap_data_taiga_id = "internal-23q2-1e49.98"
repurposing_list_taiga_id = (
    "repurposing-23q2-a803.3/Repurposing_23Q2_Extended_Primary_Compound_List"
)
repurposing_matrix_taiga_id = (
    "repurposing-23q2-a803.3/Repurposing_23Q2_Extended_Primary_Data_Matrix"
)

### ----- CONTEXT ENRICHMENT FUNCTIONS ----- ###
def compute_ttest(entity, in_group, out_group):
    ttest_p = stats.ttest_ind(
        entity.loc[out_group].dropna(), entity.loc[in_group].dropna(), equal_var=False
    )[1]
    mean_in, mean_out = entity.loc[in_group].mean(), entity[out_group].mean()
    return pd.Series(
        [ttest_p, mean_in, mean_out, mean_in - mean_out],
        index=["t_pval", "mean_in", "mean_out", "effect_size"],
    )


def compute_fet(gene, in_group, out_group):
    ctab = pd.crosstab(
        gene.loc[in_group + out_group].index.isin(in_group),
        gene.loc[in_group + out_group] == True,
    )

    if ctab.shape[0] != 2 or ctab.shape[1] != 2:
        return pd.Series([np.nan, np.nan], index=["OR", "fet_pval"])

    fet = stats.fisher_exact(ctab)
    return pd.Series(list(fet), index=["OR", "fet_pval"])


def compute_selective_deps_for(in_group, out_group, data, discrete_data):
    in_group = list(set(in_group).intersection(set(data.index.values)))
    out_group = list(set(out_group).intersection(set(data.index.values)))
    # print('In-group:', len(in_group), '-- Out-group:', len(out_group))

    # Only run test if there are at least 3 in- and 3 out-group cell lines with data
    in_group_non_na = (
        (~data.loc[in_group].isna()).sum().where(lambda x: x >= 3).dropna()
    )
    out_group_non_na = (
        (~data.loc[out_group].isna()).sum().where(lambda x: x >= 3).dropna()
    )
    data_subset = data.loc[
        :,
        data.columns.isin(in_group_non_na.index)
        & data.columns.isin(out_group_non_na.index),
    ]
    disc_data_subset = discrete_data.loc[:, data_subset.columns]
    # print('Testable entities:', data_subset.shape[1])

    # Welch's t-test results
    ttest = data_subset.apply(compute_ttest, args=[in_group, out_group]).T
    ttest = ttest.assign(
        t_qval=sm.stats.fdrcorrection(ttest.t_pval)[1],
        t_qval_log=lambda x: -np.log10(x.t_qval),
    )

    # FET results
    fet = disc_data_subset.apply(compute_fet, args=[in_group, out_group]).T.dropna()
    fet = fet.assign(
        fet_qval=sm.stats.fdrcorrection(fet.fet_pval)[1],
        fet_qval_log=lambda x: -np.log10(x.fet_qval),
    )

    results = pd.concat([ttest, fet], axis=1)
    results = results.assign(
        n_dep_in=(disc_data_subset.loc[in_group]).sum(),
        n_dep_out=(disc_data_subset.loc[out_group]).sum(),
    )
    results = results.assign(
        frac_dep_in=results.n_dep_in / len(in_group),
        frac_dep_out=results.n_dep_out / len(out_group),
    )
    results = results.assign(OR2=results.OR.replace([np.inf], 100))
    results["log_OR"] = results.apply(
        lambda x: np.log10(x.OR2) if x.OR2 != 0 else x.OR2, axis=1
    )
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
    compute_drug_results=True,
):

    crispr_models = models[models.model_id.isin(gene_effect.index)]
    drug_effect = drug_effect.transpose()
    drug_models = models[models.model_id.isin(drug_effect.index)]

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
                % (primary_disease, lin_list[0], ", ".join(lin_list))
            )
        else:
            lineage = lineage[0]

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
            continue
        crispr_results = (
            compute_selective_deps_for(
                crispr_in_group, crispr_out_group, gene_effect, gene_dependency
            )
            .reset_index(names="entity_id")
            .assign(context_name=context, out_group=query_label)[col_order]
        )
        context_results.append(crispr_results)

        # DRUG SENSITIVITIES
        if compute_drug_results:
            drug_out_group = drug_models.query(queries[query_label]).model_id.values
            if (
                len(drug_out_group) < MIN_GROUP_SIZE
                or len(drug_in_group) < MIN_GROUP_SIZE
            ):
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
                continue
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
    OUT_FILE, compute_drug_results=True,
):
    # LOAD, FORMAT, AND FILTER DATA -- probably changed when part of portal pipeline
    tc = create_taiga_client_v3()

    models = tc.get(f"{depmap_data_taiga_id}/Model")[
        ["ModelID", "StrippedCellLineName", "OncotreePrimaryDisease", "OncotreeLineage"]
    ].rename(
        columns={
            "ModelID": "model_id",
            "OncotreePrimaryDisease": "primary_disease",
            "OncotreeLineage": "lineage",
        }
    )

    ### ---- CRISPR data ---- ###
    CRISPRGeneDependency = tc.get(f"{depmap_data_taiga_id}/CRISPRGeneDependency")
    CRISPRGeneEffect = tc.get(f"{depmap_data_taiga_id}/CRISPRGeneEffect")
    CRISPRInferredCommonEssentials = tc.get(
        f"{depmap_data_taiga_id}/CRISPRInferredCommonEssentials"
    )

    # filter CRISPR data --> Restrict analysis to genes that are dep in min. 3
    #                       cell lines and NOT common essential!
    n_dep_lines = (CRISPRGeneDependency > 0.5).sum()
    incl_genes = n_dep_lines[
        (n_dep_lines >= 3)
        & ~n_dep_lines.index.isin(CRISPRInferredCommonEssentials.Essentials)
    ]
    gene_effect = CRISPRGeneEffect.loc[:, incl_genes.index]
    gene_dependency = CRISPRGeneDependency.loc[:, gene_effect.columns] > 0.5

    ### ---- PRISM data ---- ###
    drug_compounds = tc.get(repurposing_list_taiga_id)
    drug_sensitivity = tc.get(repurposing_matrix_taiga_id)

    # filter PRISM data --> global drug filters?
    drug_discrete = drug_sensitivity.T < np.log2(0.3)

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
            compute_drug_results=compute_drug_results,
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
            compute_drug_results=compute_drug_results,
        )
        if len(context_results) != 0:
            all_results.append(context_results)

    assert len(all_results) > 0
    results = pd.concat(all_results)

    dummy_value = ""
    results = results.fillna(dummy_value)

    contexts = [
        "Ewings_sarcoma",
        "bone",
        "osteosarcoma",
        "lung",
        "lung_adenocarcinoma",
        "lung_NSC",
        "lung_squamous",
        "melanoma",
        "skin",
        "colorectal",
        "Merkel",
        "urinary_tract",
        "leukemia",
        "AML",
    ]

    mapper = {
        "Ewing Sarcoma": "Ewings_sarcoma",
        "Bone": "bone",
        "Osteosarcoma": "osteosarcoma",
        "Lung": "lung",
        "Lung Adenocarcinoma": "lung_adenocarcinoma",
        "Lung NSC": "lung_NSC",
        "Lung Squamous": "lung_squamous",
        "Melanoma": "melanoma",
        "Skin": "skin",
        "Colorectal": "colorectal",
        "Merkel": "Merkel",
        "Bladder/Urinary Tract": "urinary_tract",
        "Leukemia": "leukemia",
        "AML": "AML",
    }
    results = results.replace(mapper)
    subsetted_df = results[results["context_name"].isin(contexts)]
    subsetted_df.to_csv(OUT_FILE, index=False)

    return


if __name__ == "__main__":
    compute_context_explorer_results(
        "", compute_drug_results=True,
    )
