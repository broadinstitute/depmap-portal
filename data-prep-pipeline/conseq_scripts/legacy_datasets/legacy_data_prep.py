from taigapy import create_taiga_client_v3
from data_prep_pipeline.utils import update_taiga

# Target dataset ID
target_dataset_id = "predictability-legacy-datasets-8c54"

# Confounders
rnai_confounders_taiga_id = "confounders-f38f.2/demeter2-combined-v12-confounders"
oncref_confounders_taiga_id = "prism-oncology-reference-set-23q4-1a7c.11/PRISM_Oncology_Reference_23Q4_Confounders"
rep_single_pt_confounders_taiga_id = "repurposing-public-23q2-341f.10/Repurposing_Public_23Q2_Extended_Matrix_Confounders"

# Metabolomics
metabolomics_taiga_id = "metabolomics-cd0c.4/CCLE_metabolomics_20190502"

# RPPA
rppa_matrix_taiga_id = "repurposing-public-23q2-341f.10/Repurposing_Public_23Q2_RPPA"
rppa_mapping_taiga_id = (
    "repurposing-public-23q2-341f.10/Repurposing_Public_23Q2_RPPA_Mapping"
)

# RNAi
rnai_taiga_id = "demeter2-combined-dc9c.19/gene_means_proc"


def process_and_update_rnai_confounders():
    tc = create_taiga_client_v3()
    rnai_confounders_matrix = tc.get(rnai_confounders_taiga_id)
    rnai_confounders_matrix.set_index("Row.name", inplace=True)
    rnai_confounders_matrix.index.name = None
    update_taiga(
        rnai_confounders_matrix,
        "Update RNAi confounders data for predictability",
        target_dataset_id,
        "PredictabilityFusionTransformed",
    )


def process_and_update_oncref_confounders():
    tc = create_taiga_client_v3()
    oncref_confounders = tc.get(oncref_confounders_taiga_id)
    update_taiga(
        oncref_confounders,
        "Update oncref confounders data for predictability",
        target_dataset_id,
        "OncRefConfounders",
    )


def process_and_update_rep_single_pt_confounders():
    tc = create_taiga_client_v3()
    rep_single_pt_confounders = tc.get(rep_single_pt_confounders_taiga_id)
    update_taiga(
        rep_single_pt_confounders,
        "Update repurposing single point confounders data for predictability",
        target_dataset_id,
        "RepSinglePtConfounders",
    )


def process_and_update_metabolomics():
    tc = create_taiga_client_v3()
    metabolomics = tc.get(metabolomics_taiga_id)
    update_taiga(
        metabolomics,
        "Update metabolomics data for predictability",
        target_dataset_id,
        "Metabolomics",
    )


def process_and_update_rppa():
    tc = create_taiga_client_v3()
    rppa_matrix = tc.get(rppa_matrix_taiga_id)
    rppa_mapping = tc.get(rppa_mapping_taiga_id)

    # Check that the Antibody_Name column is valid and this is the mapping table
    assert (
        "Akt_pS473" in rppa_mapping["Antibody_Name"].values
    ), "Antibody_Name 'Akt_pS473' not found in the mapping table."

    # Split the Target_Genes column by space
    rppa_mapping = rppa_mapping.assign(
        Target_Genes=rppa_mapping["Target_Genes"].str.split(" ")
    ).explode("Target_Genes")
    # Add 'rename' column
    rppa_mapping["rename"] = (
        rppa_mapping["Target_Genes"] + " (" + rppa_mapping["Antibody_Name"] + ")"
    )

    assert rppa_matrix.shape[1] < 300
    rppa_df = rppa_matrix.T

    # Merge the data and mapping DataFrames
    merged = rppa_df.reset_index().merge(
        rppa_mapping[["rename", "Antibody_Name"]],
        left_on="index",
        right_on="Antibody_Name",
        how="right",
    )
    merged.index = merged["rename"]
    merged = merged.drop(columns=["rename", "index", "Antibody_Name"])
    merged.index.name = None
    renamed_data = merged.T

    # Sanity checks
    assert (
        renamed_data.shape[0] == rppa_matrix.shape[0]
    ), "The number of cell lines does not match."
    assert renamed_data.shape[1] == len(
        rppa_mapping
    ), "The number of rows does not match the manipulated mapping."
    assert (
        renamed_data.loc[:, "AKT1 (Akt_pS473)"]
        == renamed_data.loc[:, "AKT2 (Akt_pS473)"]
    ).all(), "The row was not duplicated correctly."

    update_taiga(
        renamed_data, "Update RPPA data for predictability", target_dataset_id, "RPPA"
    )


def process_and_update_rnai():
    tc = create_taiga_client_v3()
    rnai = tc.get(rnai_taiga_id)
    rnai = rnai.T
    update_taiga(
        rnai, "Update rnai dep data for predictability", target_dataset_id, "RNAiDep",
    )


def main():
    process_and_update_rnai()
    process_and_update_rnai_confounders()
    process_and_update_oncref_confounders()
    process_and_update_rep_single_pt_confounders()
    process_and_update_metabolomics()
    process_and_update_rppa()


if __name__ == "__main__":
    main()
