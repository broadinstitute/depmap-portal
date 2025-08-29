import re
import pandas as pd
import argparse
import json
from google.cloud import storage

from taigapy import create_taiga_client_v3


def get_ctd_summary(tc, ctd2_drug_taiga_id, Model):
    print("getting ctd summary...")
    # CTD
    ctd = tc.get(ctd2_drug_taiga_id)

    ctd.rename(columns={"ccl_name": "CellLineName"}, inplace=True)

    ctd_broad_summary = pd.merge(
        ctd[["CellLineName"]], Model[["CellLineName", "ModelID"]]
    )
    ctd_broad_summary = (
        ctd_broad_summary.assign(Drug_CTD_Broad=True)
        .set_index("ModelID")
        .drop(columns=["CellLineName"])
    )

    return ctd_broad_summary


def get_repurposing_summary(tc, repurposing_matrix_taiga_id):
    # Repurposing
    print("getting repurposing summary...")
    Repurposing = tc.get(repurposing_matrix_taiga_id)
    Repurposing = Repurposing.transpose()
    Repurposing = Repurposing.reset_index(names=["ModelID"])

    repurposing_summary = (
        Repurposing[["ModelID"]]
        .assign(Drug_Repurposing_Broad=True)
        .drop_duplicates()
        .set_index("ModelID")
    )

    return repurposing_summary


def get_gdsc_summary(tc, gdsc_drug_taiga_id):
    print("getting gdsc summary...")
    gdsc = tc.get(gdsc_drug_taiga_id)
    gdsc = gdsc.rename(columns={"ARXSPAN_ID": "ModelID"})

    gdsc_summary = (
        gdsc[["ModelID"]]
        .assign(Drug_GDSC_Sanger=True)
        .drop_duplicates()
        .set_index("ModelID")
    )

    return gdsc_summary


def preprocess_omics_dataframe(df, dataset_id):
    """
    Preprocesses Omics dataframes with standard filtering steps:
    1. Filter to default entries per model (IsDefaultEntryForModel == "Yes")
    2. Assert no duplicate ModelID after filtering
    3. Drop metadata columns
    4. Set ModelID as index
    5. Drop columns with all NaN values
    """

    # Check if this dataframe needs preprocessing (has the required columns)
    if "IsDefaultEntryForModel" not in df.columns:
        print(
            f"No IsDefaultEntryForModel column found in {dataset_id}, skipping preprocessing"
        )
        return df

    print(f"Preprocessing {dataset_id}...")
    print("Filtering to default entries per model...")
    filtered_df = df[df["IsDefaultEntryForModel"] == "Yes"].copy()

    dataset_name = dataset_id.split("/")[-1]
    if dataset_name in [
        "OmicsFusionFiltered",
        "OmicsProfiles",
        "OmicsSomaticMutations",
    ]:
        print(f"Warning: {dataset_id} has multiple entries per ModelID")
    else:
        assert (
            not filtered_df["ModelID"].duplicated().any()
        ), f"Duplicate ModelID after filtering in {dataset_id}"
        print("Setting ModelID as index...")
        filtered_df = filtered_df.set_index("ModelID")
        filtered_df.index.name = None

    print("Dropping some metadata columns...")
    cols_to_drop = [
        "SequencingID",
        "ModelConditionID",
        "IsDefaultEntryForModel",
        "IsDefaultEntryForMC",
    ]
    existing_cols_to_drop = [c for c in cols_to_drop if c in filtered_df.columns]
    if existing_cols_to_drop:
        filtered_df = filtered_df.drop(columns=existing_cols_to_drop)

    count_all_na_columns = filtered_df.isna().all().sum()
    print(f"Number of columns with ALL NA values: {count_all_na_columns}")

    if count_all_na_columns > 0:
        print(f"Data shape before dropping: {filtered_df.shape}")
        print("Dropping columns with all NaN values...")
        filtered_df = filtered_df.dropna(axis=1, how="all")
        print(f"Data shape after dropping: {filtered_df.shape}")

    print(f"Finished preprocessing {dataset_id}")
    return filtered_df


def get_oncref_summary(tc, depmap_oncref_taiga_id):
    # OncRef
    print("getting OncRef summary...")
    oncref_df = tc.get(depmap_oncref_taiga_id)
    oncref_df_models_only = pd.DataFrame({"ModelID": oncref_df.index})
    oncref_summary = (
        oncref_df_models_only[["ModelID"]]
        .assign(Drug_OncRef_Broad=True)
        .drop_duplicates()
        .set_index("ModelID")
    )

    return oncref_summary


def get_rnai_marcotte_summary(tc, marcotte_taiga_id, Model):
    print("getting rnai marcotte summary...")
    marcotte = tc.get(marcotte_taiga_id)
    marcotte = marcotte.transpose()

    marcotte_summary = pd.merge(
        pd.Series(marcotte.index, name="CCLEName"), Model[["CCLEName", "ModelID"]]
    )
    marcotte_summary = (
        marcotte_summary.assign(RNAi_Marcotte=True)
        .set_index("ModelID")
        .drop(columns=["CCLEName"])
    )

    return marcotte_summary


def get_rnai_achilles_broad_summary(tc, rnai_taiga_id, Model):
    print("getting rnai_achilles_broad_summary...")
    # RNAi Screens - Achilles (Broad)
    CL_data_comb = tc.get(rnai_taiga_id)

    rnai_achilles_broad_summary = pd.merge(
        pd.Series(CL_data_comb.columns, name="CCLEName"), Model[["CCLEName", "ModelID"]]
    )
    rnai_achilles_broad_summary = (
        rnai_achilles_broad_summary.assign(RNAi_Achilles_Broad=True)
        .set_index("ModelID")
        .drop(columns=["CCLEName"])
    )

    return rnai_achilles_broad_summary


def get_drive_novartis_summary(tc, drive_novartis_taiga_id, Model):
    print("getting drive_novartis_summary...")
    drive_novartis = tc.get(drive_novartis_taiga_id)

    drive_novartis_summary = pd.merge(
        pd.Series(drive_novartis.index, name="CCLEName"), Model[["CCLEName", "ModelID"]]
    )
    drive_novartis_summary = (
        drive_novartis_summary.assign(RNAi_Drive_Novartis=True)
        .set_index("ModelID")
        .drop(columns=["CCLEName"])
    )

    return drive_novartis_summary


def get_olink_summary(tc, olink_taiga_id):
    print("getting olink summary...")
    Olink = tc.get(olink_taiga_id)

    Olink = Olink.reset_index(names=["ModelID"])

    olink_summary = (
        Olink[["ModelID"]]
        .assign(Proteomics_Olink=True)
        .drop_duplicates()
        .set_index("ModelID")
    )

    return olink_summary


def get_rppa_ccle_summary(tc, rppa_ccle_taiga_id):
    print("getting rppa_ccle_summary")
    Rppa = tc.get(rppa_ccle_taiga_id)

    Rppa = Rppa.reset_index(names=["ModelID"])

    rppa_ccle_summary = (
        Rppa[["ModelID"]]
        .assign(Proteomics_RPPA_CCLE=True)
        .drop_duplicates()
        .set_index("ModelID")
    )

    return rppa_ccle_summary


def get_ms_ccle_summary(tc, ms_ccle_taiga_id, Model):
    print("getting ms_ccle_summary")
    df = tc.get(ms_ccle_taiga_id)
    cell_line_cols = [col for col in df.columns if re.match(r".*_TenPx\d*", col)]
    df = df[cell_line_cols]
    renames = {}
    for col in df.columns:
        ccle_name = re.split(r"_TenPx\d*", col)[0]
        renames[col] = ccle_name
    df = df.rename(columns=renames)
    df = df.transpose()

    ms_ccle_summary = pd.merge(
        pd.Series(df.index, name="CCLEName"), Model[["CCLEName", "ModelID"]]
    )
    ms_ccle_summary = (
        ms_ccle_summary.assign(Proteomics_MS_CCLE=True)
        .drop_duplicates()
        .set_index("ModelID")
        .drop(columns=["CCLEName"])
    )

    return ms_ccle_summary


def get_ms_sanger_summary(tc, ms_sanger_taiga_id, Model):
    print("getting ms_sanger_summary")
    ms_sanger = tc.get(ms_sanger_taiga_id)

    ms_sanger = ms_sanger.reset_index(names=["ModelID"])

    ms_sanger_summary = (
        ms_sanger[["ModelID"]]
        .assign(Proteomics_MS_Sanger=True)
        .drop_duplicates()
        .set_index("ModelID")
    )

    return ms_sanger_summary


def get_omics_summary(tc, omics_taiga_id):
    print("getting omics_summary...")
    OmicsProfiles = tc.get(omics_taiga_id)
    OmicsProfiles = preprocess_omics_dataframe(OmicsProfiles, omics_taiga_id)
    # if the case is wrong on Datatype, fix it (the new capitalization was introduced 25Q2)
    OmicsProfiles.rename(columns={"DataType": "Datatype"}, inplace=True)

    if "Source" not in OmicsProfiles:
        omics_summary = OmicsProfiles[["ModelID", "Datatype"]].drop_duplicates()

        omics_summary = pd.pivot(
            omics_summary.assign(value=True),
            index="ModelID",
            columns="Datatype",
            values="value",
        )

        omics_summary = omics_summary.drop(columns=["wes"])

        omics_summary = (
            omics_summary.rename(
                columns={"rna": "Sequencing_RNA_Broad", "wgs": "Sequencing_WGS_Broad"}
            )
            .fillna(False)
            .astype(bool)
        )
    else:
        OmicsProfiles["Datatype"][OmicsProfiles["Datatype"] == "wes"] = (
            OmicsProfiles.Source + "_" + OmicsProfiles.Datatype
        )

        # RNA (Broad), WGS (Broad), WES (Broad)
        omics_summary = OmicsProfiles[["ModelID", "Datatype"]].drop_duplicates()

        omics_summary = pd.pivot(
            omics_summary.assign(value=True),
            index="ModelID",
            columns="Datatype",
            values="value",
        )

        omics_summary = (
            omics_summary.rename(
                columns={
                    "rna": "Sequencing_RNA_Broad",
                    "BROAD_wes": "Sequencing_WES_Broad",
                    "SANGER_wes": "Sequencing_WES_Sanger",
                    "wgs": "Sequencing_WGS_Broad",
                }
            )
            .fillna(False)
            .astype(bool)
        )

    return omics_summary


def get_crispr_summary(tc, crispr_screen_sequence_map_taiga_id):
    "Returns a dict of center name -> set of model IDs screened at the center"
    print("getting get_crispr_screening_sources")
    ScreenSequenceMap = tc.get(crispr_screen_sequence_map_taiga_id)
    # map the library to the institution that ran screens with that library. If a library
    # is added in the future, we'll get a KeyError and need to update this map
    library_to_source = {"Avana": "broad", "Humagne-CD": "broad", "KY": "sanger"}
    ScreenSequenceMap["Source"] = [
        library_to_source[x] for x in ScreenSequenceMap["Library"]
    ]

    valid_screens = ScreenSequenceMap[
        (ScreenSequenceMap.ModelID != "pDNA") & (ScreenSequenceMap.PassesQC)
    ].copy()

    return pd.DataFrame(
        {
            "CRISPR_Achilles_Broad": valid_screens.groupby("ModelID").apply(
                lambda x: "broad" in set(x["Source"])
            ),
            "CRISPR_Score_Sanger": valid_screens.groupby("ModelID").apply(
                lambda x: "sanger" in set(x["Source"])
            ),
        }
    )
    # return { source: set(crispr_summary["ModelID"][crispr_summary["Source"] == source]) for source in set(crispr_summary["Source"]) }


def get_meythlation_sanger_summary(tc, methylation_sanger_taiga_id):
    print("getting meythlation_sanger_summary")
    methylation_sanger = tc.get(methylation_sanger_taiga_id)

    methylation_sanger = methylation_sanger.reset_index(names=["ModelID"])

    methylation_sanger_summary = (
        methylation_sanger[["ModelID"]]
        .assign(Methylation_Sanger=True)
        .drop_duplicates()
        .set_index("ModelID")
    )

    return methylation_sanger_summary


def get_meythlation_ccle_summary(tc, methylation_ccle_taiga_id):
    print("getting methylation_ccle_summary...")
    methylation_ccle = tc.get(methylation_ccle_taiga_id)
    methylation_ccle = methylation_ccle.transpose()

    methylation_ccle = methylation_ccle.reset_index(names=["ModelID"])

    methylation_ccle_summary = (
        methylation_ccle[["ModelID"]]
        .assign(Methylation_CCLE=True)
        .drop_duplicates()
        .set_index("ModelID")
    )

    return methylation_ccle_summary


def get_miRNA_ccle_summary(tc, miRNA_ccle_taiga_id):
    print("getting miRNA_ccle_summary...")
    miRNA_ccle = tc.get(miRNA_ccle_taiga_id)

    miRNA_ccle = miRNA_ccle.reset_index(names=["ModelID"])

    miRNA_ccle_summary = (
        miRNA_ccle[["ModelID"]]
        .assign(Uncategorized_miRNA_CCLE=True)
        .drop_duplicates()
        .set_index("ModelID")
    )

    return miRNA_ccle_summary


def get_atac_seq_broad_summary(tc, atac_seq_broad_taiga_id):
    print("getting atac_seq_broad_summary...")
    atac_seq_broad = tc.get(atac_seq_broad_taiga_id)

    atac_seq_broad = atac_seq_broad.reset_index(names=["ModelID"])

    atac_seq_broad_summary = (
        atac_seq_broad[["ModelID"]]
        .assign(Sequencing_ATACSeq_Broad=True)
        .drop_duplicates()
        .set_index("ModelID")
    )

    return atac_seq_broad_summary


def get_paralogs_summary(tc, depmap_paralogs_taiga_id):
    print("getting paralogs summary...")
    paralogs_df = tc.get(depmap_paralogs_taiga_id)

    paralogs = paralogs_df.reset_index(names=["ModelID"])

    paralogs_summary = (
        paralogs[["ModelID"]]
        .assign(CRISPR_ParalogsScreens=True)
        .drop_duplicates()
        .set_index("ModelID")
    )

    return paralogs_summary


def get_long_reads_summary(tc, taiga_ids):
    """
    Get a summary of the long reads data available for each cell line.

    Returns:
        pd.DataFrame: Indexed by ModelID, with a column of True values that will be filterd against the Model table in future
    """

    print("getting long_reads_summary...")

    unique_model_ids = set()

    for taiga_id in taiga_ids:
        df = tc.get(taiga_id)

        assert "ModelID" in df.columns, f"Column 'ModelID' not found in file {taiga_id}"
        unique_model_ids.update(df["ModelID"].unique())

    assert len(unique_model_ids) > 0, "No model IDs found in the provided files"
    print(f"Length of unique_model_ids: {len(unique_model_ids)}")

    # Note: Converting unique_model_ids to a list due to a breaking change between pandas 1.4.3 and 1.5.3 regarding using sets as DataFrame indices.
    # Since pandas 1.5.3, using a set as an index raises a ValueError.
    long_reads_summary = pd.DataFrame(
        index=list(unique_model_ids), columns=["Sequencing_Long_Reads"], data=True
    )

    assert len(long_reads_summary) == len(
        unique_model_ids
    ), "Number of rows in DataFrame doesn't match number of unique model IDs"

    return long_reads_summary


def get_taiga_id(possible_id, id_key="dataset_id"):
    return [] if len(possible_id) == 0 else [possible_id[0][id_key]]


def get_taiga_ids(possible_ids, id_key="dataset_id"):
    return (
        []
        if len(possible_ids) == 0
        else [possible_id[id_key] for possible_id in possible_ids]
    )


def main(
    inputs, out_filename,
):
    with open(inputs, "rt") as input_json:
        taiga_ids = json.load(input_json)

    # taiga ids
    depmap_data_taiga_id = get_taiga_id(taiga_ids["depmap_data_taiga_id"])
    depmap_oncref_taiga_id = get_taiga_id(taiga_ids["oncref_taiga_id"])
    rnai_drive_taiga_id = get_taiga_id(taiga_ids["rnai_drive_taiga_id"])
    repurposing_matrix_taiga_id = get_taiga_id(taiga_ids["repurposing_matrix_taiga_id"])
    ctd2_drug_taiga_id = get_taiga_id(taiga_ids["ctd2_drug_taiga_id"])
    gdsc_drug_taiga_id = get_taiga_id(taiga_ids["gdsc_drug_taiga_id"])
    rppa_taiga_id = get_taiga_id(taiga_ids["rppa_taiga_id"], "matrix_dataset_id")
    ms_ccle_taiga_id = get_taiga_id(taiga_ids["ms_ccle_taiga_id"])
    sanger_methylation_taiga_id = get_taiga_id(taiga_ids["sanger_methylation_taiga_id"])
    methylation_ccle_taiga_id = get_taiga_id(taiga_ids["methylation_ccle_taiga_id"])
    ccle_mirna_taiga_id = get_taiga_id(taiga_ids["ccle_mirna_taiga_id"])
    atac_seq_taiga_id = get_taiga_id(taiga_ids["ataq_seq_taiga_id"])
    olink_taiga_id = get_taiga_id(taiga_ids["olink_taiga_id"])
    ms_sanger_taiga_id = get_taiga_id(taiga_ids["sanger_proteomics_taiga_id"])
    depmap_paralogs_taiga_id = get_taiga_id(taiga_ids["depmap_paralogs_taiga_id"])
    rnai_broad_only_taiga_id = get_taiga_id(taiga_ids["rnai_broad_only"])
    crispr_screen_sequence_map_taiga_id = get_taiga_id(
        taiga_ids["crispr_screen_sequence_map"]
    )
    depmap_long_reads_taiga_ids = get_taiga_ids(taiga_ids["depmap_long_reads_datasets"])

    tc = create_taiga_client_v3()
    gcloud_storage_client = storage.Client()

    Model = tc.get(f"{depmap_data_taiga_id[0]}/Model")
    assert Model is not None

    ####################
    ### DRUG SCREENS ###
    ####################
    ctd_broad_summary = get_ctd_summary(
        tc=tc,
        ctd2_drug_taiga_id=f"{ctd2_drug_taiga_id[0]}/v20.meta.per_cell_line",
        Model=Model,
    )
    assert ctd_broad_summary.index.is_unique

    # should be None for public
    repurposing_summary = None
    if len(repurposing_matrix_taiga_id) > 0:
        repurposing_summary = get_repurposing_summary(
            tc=tc, repurposing_matrix_taiga_id=repurposing_matrix_taiga_id[0]
        )
        assert repurposing_summary.index.is_unique

    gdsc_summary = get_gdsc_summary(
        tc=tc, gdsc_drug_taiga_id=f"{gdsc_drug_taiga_id[0]}/SANGER_VIABILITY"
    )
    assert gdsc_summary.index.is_unique

    # should be None for public
    oncref_summary = None
    if len(depmap_oncref_taiga_id) > 0:
        oncref_summary = get_oncref_summary(
            tc=tc,
            depmap_oncref_taiga_id=f"{depmap_oncref_taiga_id[0]}/PRISMOncologyReferenceViabilityMatrix",
        )
        assert oncref_summary.index.is_unique

    ############
    ### RNAi ###
    ############
    rnai_achilles_broad_summary = get_rnai_achilles_broad_summary(
        tc=tc, rnai_taiga_id=rnai_broad_only_taiga_id[0], Model=Model,
    )
    assert rnai_achilles_broad_summary.index.is_unique
    assert len(rnai_achilles_broad_summary.index) > 0

    # Taiga id for this dataset is hard coded because it is old and no longer updated
    rnai_marcotte_summary = get_rnai_marcotte_summary(
        tc=tc,
        marcotte_taiga_id="marcottte-breast-77-lines-shrna-a68b.1/breast_zgarp_marcotte",
        Model=Model,
    )
    assert rnai_marcotte_summary.index.is_unique

    drive_novartis_summary = get_drive_novartis_summary(
        tc=tc,
        drive_novartis_taiga_id=f"{rnai_drive_taiga_id[0]}/gene_dependency",
        Model=Model,
    )
    assert drive_novartis_summary.index.is_unique

    ##################
    ### Proteomics ###
    ##################
    # Olink
    olink_summary = None
    if len(olink_taiga_id) > 0:
        olink_summary = get_olink_summary(tc=tc, olink_taiga_id=olink_taiga_id[0])
        assert olink_summary.index.is_unique

    # RPPA (CCLE)
    rppa_ccle_summary = get_rppa_ccle_summary(
        tc=tc, rppa_ccle_taiga_id=rppa_taiga_id[0]
    )
    assert rppa_ccle_summary.index.is_unique
    # MS (CCLE)
    ms_ccle_summary = get_ms_ccle_summary(
        tc=tc, ms_ccle_taiga_id=ms_ccle_taiga_id[0], Model=Model
    )
    assert ms_ccle_summary.index.is_unique

    # MS (Sanger)
    ms_sanger_summary = None
    if len(ms_sanger_taiga_id) > 0:
        ms_sanger_summary = get_ms_sanger_summary(
            tc=tc, ms_sanger_taiga_id=ms_sanger_taiga_id[0], Model=Model
        )
        assert ms_sanger_summary.index.is_unique

    #################
    ### Sequencing###
    #################

    # WES (Broad), WES (Sanger), WGS (Broad), RNA (Broad)
    omics_summary = get_omics_summary(
        tc=tc, omics_taiga_id=f"{depmap_data_taiga_id[0]}/OmicsProfiles"
    )
    assert omics_summary.index.is_unique

    #################
    ### Long Reads ###
    #################
    long_reads_summary = None
    if len(depmap_long_reads_taiga_ids) > 0:
        long_reads_summary = get_long_reads_summary(
            tc=tc, taiga_ids=depmap_long_reads_taiga_ids
        )
        assert long_reads_summary.index.is_unique

    #####################
    ### CRISPR Screens###
    #####################
    # Score (Sanger)
    crispr_summary = get_crispr_summary(tc, crispr_screen_sequence_map_taiga_id[0])

    # Paralogs
    paralogs_summary = None
    if len(depmap_paralogs_taiga_id) > 0:
        paralogs_summary = get_paralogs_summary(
            tc=tc, depmap_paralogs_taiga_id=depmap_paralogs_taiga_id[0]
        )
        assert paralogs_summary.index.is_unique

    ##################
    ### Methylation###
    ##################
    # (Methylation) Sanger
    methylation_sanger_summary = None
    if len(sanger_methylation_taiga_id) > 0:
        methylation_sanger_summary = get_meythlation_sanger_summary(
            tc=tc, methylation_sanger_taiga_id=sanger_methylation_taiga_id[0],
        )
        assert methylation_sanger_summary.index.is_unique

    # Methylation (CCLE)
    methylation_ccle_summary = get_meythlation_ccle_summary(
        tc=tc, methylation_ccle_taiga_id=methylation_ccle_taiga_id[0]
    )
    assert methylation_ccle_summary.index.is_unique

    ####################
    ### Uncategorized###
    ####################
    # miRNA (CCLE)
    miRNA_ccle_summary = get_miRNA_ccle_summary(
        tc=tc, miRNA_ccle_taiga_id=ccle_mirna_taiga_id[0]
    )
    assert miRNA_ccle_summary.index.is_unique

    atac_seq_broad_summary = None
    if len(atac_seq_taiga_id) > 0:
        atac_seq_broad_summary = get_atac_seq_broad_summary(
            tc=tc, atac_seq_broad_taiga_id=atac_seq_taiga_id[0],
        )
        assert atac_seq_broad_summary.index.is_unique

    # pd.concat should drop any Nones
    overall_summary = pd.concat(
        [
            ctd_broad_summary,
            repurposing_summary,
            gdsc_summary,
            oncref_summary,
            rnai_achilles_broad_summary,
            rnai_marcotte_summary,
            drive_novartis_summary,
            olink_summary,
            rppa_ccle_summary,
            ms_ccle_summary,
            omics_summary,
            crispr_summary,
            methylation_sanger_summary,
            methylation_ccle_summary,
            miRNA_ccle_summary,
            atac_seq_broad_summary,
            ms_sanger_summary,
            paralogs_summary,
            long_reads_summary,
        ],
        axis=1,
    )

    overall_summary = overall_summary.fillna(False).astype(bool)

    overall_summary.index.rename("ModelID", inplace=True)

    # Make sure only ModelIDs that appear in the Model file are included in the final
    # overall_summary data array.
    overall_summary = overall_summary[
        overall_summary.index.isin(Model["ModelID"].values)
    ]
    overall_summary.to_csv(out_filename)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("inputs")
    parser.add_argument("out_filename")
    args = parser.parse_args()
    main(
        args.inputs, args.out_filename,
    )
