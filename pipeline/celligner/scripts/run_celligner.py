#%%
import celligner


#%%
import numpy as np
import pandas as pd
import re
from taigapy import TaigaClient
import anndata as ad
from collections import namedtuple
from anndata.experimental.multi_files import AnnCollection
import requests
import argparse
import json
import pickle as pkl
import os
from sklearn.decomposition import PCA
import warnings

tc = taigapy.create_taiga_client_v3()

expr_dict = {""}
ann_dict = {""}
"""
TaigaPointer = namedtuple('TaigaPointer', ['depmap_expr',
                                           'depmap_ann',
                                           'tcga_expr',
                                           'tcga_ann',
                                           'met500_expr',
                                           'met500_ann',
                                           'nov_pdx_expr',
                                           'nov_pdx_ann',
                                           'ped_pdx_expr',
                                           'ped_pdx_ann'
                                           ])
DatasetTup = namedtuple('DatasetTup', 'source_dataset_id')

inputs = TaigaPointer(depmap_expr=DatasetTup(source_dataset_id='internal-23q2-1e49.65/OmicsExpressionProteinCodingGenesTPMLogp1'),
                      depmap_ann=DatasetTup(source_dataset_id='internal-23q2-1e49.90/Model'),
                      tcga_expr=DatasetTup(source_dataset_id='celligner-input-9827.10/tumor_expression'),
                      tcga_ann=DatasetTup(source_dataset_id='celligner-input-9827.10/tumor_annotations'),
                      met500_expr=DatasetTup(source_dataset_id='met500-fc3c.2/met500_TPM'),
                      met500_ann=DatasetTup(source_dataset_id='met500-fc3c.3/met500_ann'),
                      nov_pdx_expr=DatasetTup(source_dataset_id='pdx-data-3d29.2/Novartis_PDX_TPM'),
                      nov_pdx_ann=DatasetTup(source_dataset_id='pdx-data-3d29.2/Novartis_PDX_ann'),
                      ped_pdx_expr=DatasetTup(source_dataset_id='pdx-data-3d29.2/pediatric_PDX_TPM'),
                      ped_pdx_ann=DatasetTup(source_dataset_id='pdx-data-3d29.2/pediatric_PDX_ann'))
"""

headers = {
    "Accept": "application/json",
}

oncotree = tc.get(name="oncotree-42c7", version=1, file="oncotree").set_index("code")

nv_OT_map = {
    "colorectal": "BOWEL",
    "pancreas": "PANCREAS",
    "breast": "BREAST",
    "lung": "LUNG",
    "urinary_tract": "BLADDER",
    "ovary": "OVARY",
    "kidney": "KIDNEY",
    "esophagus": "STOMACH",
    "soft_tissue": "SOFT_TISSUE",
    "skin": "SKIN",
    "liver": "LIVER",
    "central_nervous_system": "BRAIN",
    "bile_duct": "BILIARY_TRACT",
    "upper_aerodigestive": "HEAD_NECK",
    "small_intestine": "BOWEL",
    "bone": "BONE",
    "autonomic_ganglia": "BRAIN",
    "uterus": "UTERUS",
    "gastric": "STOMACH",
    "lymphocyte": "LYMPH",
    "meninges": "BRAIN",
    "NS": "OTHER",
}

ped_oncotree_map = {
    "ASPS": "ASPS",
    "Astrocytoma": "ASTR",
    "ATRT": "ATRT",
    "BCP-ALL": "BLL",
    "Clear Cell Sarcoma": "CCS",
    "CNS EFT-CIC": "PBT",
    "CNS embryonal NOS": "EMBT",
    "CNS germinoma": "GMN",
    "Colon Carcinoma": "COLON",  #
    "DIPG": "DIPG",
    "Ependymoblastoma": "BRAIN",  #
    "Ependymoma": "EPMT",  #
    "ETMR": "EMBT",
    "ETP-ALL": "ETPLL",
    "Ewing Sarcoma": "ES",
    "Extracranial Rhabdoid": "MRT",  #
    "Fusion+ RMS": "RMS",  #
    "Fusion- RMS": "RMS",  #
    "Glioblastoma": "GB",
    "Hepatoblastoma": "LIHB",
    "Medulloblastoma": "MBL",
    "MLL-ALL": "LNM",
    "Neuroblastoma": "NBL",
    "Osteosarcoma": "OS",
    "Ph-likeALL": "LNM",
    "Ph+-ALL": "LNM",
    "Small Cell Carcinoma": "PBT",  #
    "T-ALL": "TLL",
    "Wilms": "WT",
}

portal_in_dict = {}

portal_out_dict = {}
# %%
depmap_params = {
    "name": "depmap_public_23q2",
    "taiga_name": "public-23q2-19de",
    "taiga_file": "OmicsExpressionProteinCodingGenesTPMLogp1",
    "dset_type": "model",
    "mnn_params": None,
}

tcga_params = {
    "name": "tcga",
    "taiga_name": "celligner-input-9827",
    "taiga_file": "tumor_expression",
    "dset_type": "tumor",
    "mnn_params": None,
}

met500_params = {
    "name": "met500",
    "taiga_name": "met500-fc3c",
    "taiga_file": "met500_TPM",
    "dset_type": "tumor",
    "mnn_params": {"k1": 20, "k2": 50},
}

pdx_nv_params = {
    "name": "pdx_novartis",
    "taiga_name": "pdx-data-3d29",
    "taiga_file": "Novartis_PDX_TPM",
    "dset_type": "model",
    "mnn_params": {"k1": 10, "k2": 50},
}

pdx_ped_params = {
    "name": "pdx_pediatric",
    "taiga_name": "pdx-data-3d29",
    "taiga_file": "pediatric_PDX_TPM",
    "dset_type": "model",
    "mnn_params": {"k1": 10, "k2": 50},
}

celligner_default_extras = [met500_params, pdx_nv_params, pdx_ped_params]


# %%
def process_oncocode(code):
    """
    Generates a disease annotation given an oncotree code
    @param code: (str) oncotree code
    @return: (Pandas Series) Disease lineage and subtype associated with the oncotree code
    """
    if code in oncotree.index:
        row = oncotree.loc[code]
        return pd.Series({"lineage": row.tissue, "subtype": row["name"]})
    else:
        return pd.Series({"lineage": np.nan, "subtype": np.nan})


def process_tcga_ipts(expr_df, context_df):
    """
    Collects TCGA expression data and metadata into single anndata object, and standardizes the metadata.
    @param expr_df: (Pandas DataFrame) TCGA expression data, same format as depmap expression data (reprocessed from actual TCGA release)
    @param context_df: (Pandas DataFrame) TCGA metadata pulled from taiga
    @return: anndata object containing both TCGA expression and metadata
    """
    context_df = context_df.set_index("sampleID")

    context_w_code = context_df[~context_df.oncotree_code.isna()]
    context_w_code.loc[:, ["lineage", "subtype"]] = context_w_code.oncotree_code.apply(
        lambda x: process_oncocode(x)
    )

    context_nocode = context_df[context_df.oncotree_code.isna()]
    context_nocode = context_nocode.rename(
        columns={"lineage": "_lineage", "oncotree_lineage": "lineage"}
    )
    context_df = pd.concat([context_w_code, context_nocode])

    context_df["type"] = "TCGA+ tumor"
    context_df["GrowthPattern"] = "Tumor"
    context_df["PrimaryOrMetastasis"] = "Primary"
    adata = ad.AnnData(expr_df)
    adata.uns["type"] = "tumor"
    adata.uns["name"] = "tcga"
    adata.uns["mnn_params"] = None
    adata.obs = context_df.loc[
        expr_df.index,
        ["GrowthPattern", "PrimaryOrMetastasis", "lineage", "subtype", "type"],
    ]
    return adata


def process_depmap_ipts(expr_df, context_df, prof_map, model_condition):
    """

    Args:
        expr_df: Pandas Dataframe. DepMap expression data, pulled from taiga
        context_df: Pandas DataFrame. artifact input from conseq file with either type = biomarker-matrix and category = context
                or type = context-matrix (not sure what the difference is)
        prof_map: Pandas DataFrame. maping from profile ID to model ID/model condition ID
        model_condition: Pandas DataFrame. table containing information on model conditions, including growth media

    Returns: anndata object. Observations are indexed by ModelID and variables are ensembl IDs. Includes model metadata.
            Model metadata included are: lineage, subtype, type (provenance), primary/metastasis,
            and growth pattern (adherent, neurosphere, etc). For entries with an oncotree code, the lineage is taken as
            the oncotree tissue and the sybtype is simply the oncotree name. Otherwise we use the OncotreeLineage and
            OncoTreePrimaryDisease

    """

    hgnc_complete_set = tc.get(
        name="hgnc-gene-table-e250", version=3, file="hgnc_complete_set"
    )
    # hgnc_complete_set = hgnc_complete_set[hgnc_complete_set.locus_group == 'protein-coding gene']
    bg_genes = (
        pd.Series(expr_df.keys())
        .apply(lambda s: re.search(r"(ENSG[0-9]+)", s).group(1))
        .rename("ensembl_gene_id")
    )
    bg_genes = bg_genes.set_axis(expr_df.keys()).to_frame()
    expr_df = expr_df.rename(columns=bg_genes.to_dict()["ensembl_gene_id"])
    protein_coding = pd.Index(
        hgnc_complete_set[
            hgnc_complete_set.locus_group == "protein-coding gene"
        ].ensembl_gene_id
    )
    expr_df = expr_df[expr_df.columns.intersection(protein_coding)]

    context_df = context_df
    context_w_oncocode = context_df.loc[~context_df.OncotreeCode.isna()]
    context_w_oncocode.loc[
        :, ["lineage", "subtype"]
    ] = context_w_oncocode.OncotreeCode.apply(lambda x: process_oncocode(x))
    context_nocode = context_df.loc[context_df.OncotreeCode.isna()]
    codes_for_codeless = context_nocode[["OncotreeLineage", "OncotreePrimaryDisease"]]
    codes_for_codeless = codes_for_codeless.rename(
        columns={"OncotreeLineage": "lineage", "OncotreePrimaryDisease": "subtype"}
    )
    context_nocode.loc[:, ["lineage", "subtype"]] = codes_for_codeless
    context_df = pd.concat([context_nocode, context_w_oncocode])
    context_df["type"] = "DepMap Model"
    context_df = prof_map.merge(
        context_df,
        how="left",
        left_on="ModelID",
        right_on="ModelID",
        suffixes=(None, "_y"),
    )
    context_df = context_df.merge(
        model_condition,
        how="left",
        left_on=["ModelCondition", "ModelID"],
        right_on=["ModelConditionID", "ModelID"],
        suffixes=(None, "_y"),
    ).set_index("ProfileID")
    # warnings.warn(context_df.head().to_string())
    adata = ad.AnnData(expr_df)
    adata.obs_names = expr_df.index
    adata.var_names = expr_df.columns
    adata.uns["type"] = "model"
    adata.uns["name"] = "depmap"
    adata.uns["mnn_params"] = None
    adata.obs = context_df.loc[
        expr_df.index,
        [
            "GrowthPattern",
            "PrimaryOrMetastasis",
            "lineage",
            "subtype",
            "type",
            "FormulationID",
            "ModelConditionID",
            "ModelID",
        ],
    ]
    return adata


def process_met500_ipts(expr_df, context_df):
    """
    Collects MET500 expression data and metadata into single anndata object, and standardizes the metadata.
    @param expr_df: (Pandas DataFrame) MET500 expression data, same format as depmap expression data
    @param context_df: (Pandas DataFrame) MET500 metadata pulled from taiga
    @return: anndata object containing both MET500 expression and metadata
    """
    context_df = context_df.set_index("sampleID")

    context_df.loc[:, ["lineage", "subtype"]] = context_df.oncotree_code.apply(
        lambda x: process_oncocode(x)
    )
    context_df["GrowthPattern"] = "Tumor"
    context_df["type"] = "MET500 tumor"
    context_df["PrimaryOrMetastasis"] = "Metastatic"

    adata = ad.AnnData(expr_df)
    adata.obs_names = expr_df.index
    adata.var_names = expr_df.columns
    adata.obs = context_df.loc[
        expr_df.index,
        ["GrowthPattern", "PrimaryOrMetastasis", "lineage", "subtype", "type"],
    ]
    adata.uns["type"] = "tumor"
    adata.uns["name"] = "met500"
    adata.uns["mnn_params"] = {"k1": 20, "k2": 50}
    return adata


def process_nov_pdx_ipts(expr_df, context_df):
    """
    Collects Novartis PDX expression data and metadata into single anndata object, and standardizes the metadata.
    @param expr_df: (Pandas DataFrame) Novartis PDX expression data, same format as depmap expression data
    @param context_df: (Pandas DataFrame) Novartis PDX metadata pulled from taiga
    @return: anndata object containing both Novartis PDX expression and metadata
    """
    genes = pd.Series(expr_df.index).apply(
        lambda x: re.search(r"(ENSG[0-9]+)\.?\d*", x).group(1)
    )
    expr_df = expr_df.rename(index=genes)
    expr_df = expr_df.T

    context_df = context_df.set_index("sampleID")
    context_df["oncotree_code"] = context_df.lineage.map(nv_OT_map)
    context_df.loc[:, ["lineage", "subtype"]] = context_df.oncotree_code.apply(
        lambda x: process_oncocode(x)
    )
    context_df["GrowthPattern"] = "PDX"
    context_df["type"] = "Novartis_PDX"
    context_df["PrimaryOrMetastasis"] = np.nan

    adata = ad.AnnData(expr_df)
    adata.obs_names = expr_df.index
    adata.var_names = expr_df.columns
    adata.obs = context_df.loc[
        expr_df.index,
        ["GrowthPattern", "PrimaryOrMetastasis", "lineage", "subtype", "type",],
    ]
    adata.uns["type"] = "model"
    adata.uns["name"] = "nov_pdx"
    adata.uns["mnn_params"] = {"k1": 10, "k2": 50}
    return adata


def process_ped_pdx_ipts(expr_df, context_df):
    """
    Collects Pediatric PDX expression data and metadata into single anndata object, and standardizes the metadata.
    @param expr_df: (Pandas DataFrame) Pediatric PDX expression data, same format as depmap expression data
    @param context_df: (Pandas DataFrame) Pediatric PDX metadata pulled from taiga
    @return: anndata object containing both Pediatric PDX expression and metadata
    """
    context_df = context_df.set_index("sampleID")
    context_df["oncotree_code"] = context_df.lineage.map(ped_oncotree_map)
    context_df.loc[:, ["lineage", "subtype"]] = context_df.oncotree_code.apply(
        lambda x: process_oncocode(x)
    )
    context_df["GrowthPattern"] = "PDX"
    context_df["type"] = "Pediatric_PDX"
    context_df["PrimaryOrMetastasis"] = np.nan

    adata = ad.AnnData(expr_df)
    adata.obs_names = expr_df.index
    adata.var_names = expr_df.columns
    adata.obs = context_df.loc[
        expr_df.index,
        ["GrowthPattern", "PrimaryOrMetastasis", "lineage", "subtype", "type",],
    ]
    adata.uns["type"] = "model"
    adata.uns["name"] = "ped_pdx"
    adata.uns["mnn_params"] = {"k1": 10, "k2": 50}
    return adata


# %%


def filter_to_common_genes(bg, contrast, extra_data):
    """
    Filters set of genes from all sources to a common subset
    @param bg: (Anndata object) The background data for celligner (DepMap)
    @param contrast: (Anndata object) The contrast data for celligner (TCGA)
    @param extra_data: (list of Anndata objects) Any additional datasets
    @return:
    """
    hgnc_complete_set = tc.get(name="hgnc-87ab", version=7, file="hgnc_complete_set")
    func_genes = hgnc_complete_set[
        ~hgnc_complete_set.locus_group.isin(["non-coding RNA", "pseudogene"])
    ]
    gene_sets = [set(list(bg.var_names)), set(list(contrast.var_names))]

    bg_genes = set(bg.var_names)
    contrast_genes = set(contrast.var_names)
    if extra_data:
        extra_gene_sets = [set(list(_dat.var_names)) for _dat in extra_data]
    gene_set = set(func_genes.ensembl_gene_id)

    common_genes = pd.Index(
        gene_set.intersection(bg_genes, contrast_genes, *extra_gene_sets)
    )
    print("Common genes:", len(common_genes))
    if extra_data:
        return (
            bg[:, common_genes],
            contrast[:, common_genes],
            [_dat[:, common_genes] for _dat in extra_data],
        )
    else:
        return bg[:, common_genes], contrast[:, common_genes], None


# %%
def run_celligner(bg, contrast, extra_data=None):
    """

    Args:
        bg: anndata object. Observations are models. Features are genes indexed by ensembl id. Includes unstructured
            field "name" describing where the data came from.
        contrast: anndata object. Same format as bg
        extra_data: list of anndata objects. Same fields as bg & contrast, but includes additional unstructured fields:
            'mnn_params': either None or a dict with keys 'k1' & 'k2', each with integer values.
            'type': either 'model' or 'tumor'

    Returns: (tuple of Pandas DataFrames): UMAP locations of embedded cell lines with metadata, Tumor-cell line distance dataframe

    """
    print("Filtering to common genes...")
    bg, contrast, extra_data = filter_to_common_genes(bg, contrast, extra_data)
    # Create Celligner object and fit + transform the reference (depmap) and target (TCGA) expression datasets
    my_celligner = celligner.Celligner()
    print("Fitting background....")
    my_celligner.fit(bg.to_df())
    print("Transforming contrast...")
    my_celligner.transform(contrast.to_df())
    # add in additional datasets to be projected if they are given
    if extra_data:
        print("processing additional datasets...")
        for _dat in extra_data:

            my_celligner.makeNewReference()
            if _dat.uns["mnn_params"]:
                p = _dat.uns["mnn_params"]
                my_celligner.mnn_kwargs.update({"k1": p["k1"], "k2": p["k2"]})
            my_celligner.transform(_dat.to_df(), compute_cPCs=False)

    # Compute UMAP, clusters and tumor - model distance
    model_ids = list(bg.obs.index)
    tumor_ids = list(contrast.obs.index)
    if extra_data:
        for _dat in extra_data:
            if _dat.uns["type"] == "tumor":
                tumor_ids += list(_dat.obs.index)

            elif _dat.uns["type"] == "model":
                model_ids += list(_dat.obs.index)

    my_celligner.computeMetricsForOutput(model_ids=model_ids, tumor_ids=tumor_ids)

    outname = "celligner_output_" + bg.uns["name"] + "_" + contrast.uns["name"] + "_"
    if extra_data:
        outname += "_".join([_d.uns["name"] for _d in extra_data])
    outname += ".pkl"
    my_celligner.save(outname)
    print("Model saved to: ", outname)
    annots = []
    annots.append(bg.obs)
    annots.append(contrast.obs)
    if extra_data:
        for _dat in extra_data:
            annots.append(_dat.obs)

    df_annots = pd.concat(annots)
    df_annots = df_annots[
        [
            "lineage",
            "subtype",
            "type",
            "PrimaryOrMetastasis",
            "GrowthPattern",
            "ModelConditionID",
            "ModelID",
        ]
    ]

    out_umap = my_celligner.umap_reduced
    cluster_ids = pd.Series(
        my_celligner.output_clusters,
        index=my_celligner.combined_output.index,
        name="cluster",
    )
    out_umap["cluster"] = cluster_ids
    out = pd.merge(out_umap, df_annots, left_index=True, right_index=True)

    pca = PCA(my_celligner.pca_ncomp)
    pcs = pd.DataFrame(
        data=pca.fit_transform(my_celligner.combined_output),
        index=my_celligner.combined_output.index,
        columns=["pc_" + str(i) for i in range(my_celligner.pca_ncomp)],
    )

    return out, my_celligner.tumor_CL_dist, pcs, my_celligner.combined_output


#%%
def process_data(inputs, extra=True):
    """
    Downloads each dataset (expression + metadata) and runs a function specialized to each dataset to unify the metadata
    @param inputs: (dict) equivalent to conseq inputs file, includes data labels and taiga ID
    @param extra: (bool) include extra datasets (MET500 & PDXs) or not
    @return: (tuple of Anndata objects containing expression and metadata) Depmap, TCGA, and extra datasets
    """
    warnings.warn("loading depmap")
    depmap_expr_id = inputs["depmap_expr"]["dataset_id"]
    print(f"loading DepMap data ({depmap_expr_id})...")
    depmap_data = tc.get(depmap_expr_id)
    print(depmap_data)
    # starting in 25Q2, some additional columns got added which will need to be dropped before proceeding.
    # the following should reformat the matrix to be the format we used to get from taiga prior to 25Q2
    depmap_data.index = depmap_data["ProfileID"]
    depmap_data.drop(columns=["ProfileID", "is_default_entry", "ModelID"], inplace=True)

    warnings.warn("loading anns")
    depmap_ann = tc.get(inputs["depmap_ann"]["source_dataset_id"])
    warnings.warn("loading prof map")
    depmap_prof_map = tc.get(inputs["depmap_prof_map"]["dataset_id"])
    warnings.warn("loading model conds")
    depmap_model_cond = tc.get(inputs["depmap_model_cond"]["dataset_id"])

    depmap_out = process_depmap_ipts(
        depmap_data, depmap_ann, depmap_prof_map, depmap_model_cond
    )

    # process tcga data into single input for celligner
    warnings.warn("loading tcga")
    print("loading TCGA data...")
    tcga_expr = tc.get(inputs["tcga_expr"]["source_dataset_id"])
    tcga_ann = tc.get(inputs["tcga_ann"]["source_dataset_id"])

    tcga_out = process_tcga_ipts(tcga_expr, tcga_ann)
    warnings.warn("loading extra datasets")
    if extra:
        # process met500 data into single input for celligner
        print("loading MET500 data...")
        met500_data = tc.get(inputs["met500_expr"]["source_dataset_id"])
        met500_ann = tc.get(inputs["met500_ann"]["source_dataset_id"])

        met500_out = process_met500_ipts(met500_data, met500_ann)

        # process novartis pdx data into single input for celligner
        print("loading Novartis PDX data...")
        nov_pdx_data = tc.get(inputs["nov_pdx_expr"]["source_dataset_id"])
        nov_pdx_ann = tc.get(inputs["nov_pdx_ann"]["source_dataset_id"])

        nov_pdx_out = process_nov_pdx_ipts(nov_pdx_data, nov_pdx_ann)

        # process pediatric pdx data into single input for celligner
        print("loading Pediatric PDX data...")
        ped_pdx_data = tc.get(inputs["ped_pdx_expr"]["source_dataset_id"])
        ped_pdx_ann = tc.get(inputs["ped_pdx_ann"]["source_dataset_id"])

        ped_pdx_out = process_ped_pdx_ipts(ped_pdx_data, ped_pdx_ann)

        extra_data = [met500_out, nov_pdx_out, ped_pdx_out]
    else:
        extra_data = None
    return depmap_out, tcga_out, extra_data


# %%
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input", type=str, help="name of input file", default="inputs.json"
    )
    args = parser.parse_args()
    print("Reading inputs")
    warnings.warn("reading inputs")
    with open(args.input, "r") as fp:
        inputs = json.load(fp)
    # process depmap data into single input for celligner
    depmap_processed, tcga_processed, extra_data_processed = process_data(
        inputs, extra=True
    )
    warnings.warn("beginning alignment")
    print("Beginning alignment...")
    out, distances, pcs, combined_expression = run_celligner(
        depmap_processed, tcga_processed, extra_data_processed
    )
    corrected_expression = combined_expression.loc[
        combined_expression.index.difference(depmap_processed.obs)
    ]
    out.to_csv("celligner_output.csv")
    distances.to_csv("tumor_CL_dist.csv")
    pcs.to_csv("celligner_pcs.csv")
    corrected_expression.reset_index()
    print(corrected_expression.index)
    corrected_expression.to_csv("corrected_expression.csv")
