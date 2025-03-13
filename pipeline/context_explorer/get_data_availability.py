from taigapy import create_taiga_client_v3
import pandas as pd
import argparse


def main(
    model_taiga_id,
    screen_sequence_map_taiga_id,
    omics_profiles_taiga_id,
    repurposing_matrix_taiga_id,
    prism_oncref_auc_matrix,
    rnai_taiga_id,
    out_filename
):
    tc = create_taiga_client_v3()
    # Data for CRISPR, RNAi, Omics, PRISM
    ScreenSequenceMap = tc.get(screen_sequence_map_taiga_id)
    assert ScreenSequenceMap is not None

    CL_data_comb = tc.get(rnai_taiga_id)
    assert CL_data_comb is not None

    OmicsProfiles = tc.get(omics_profiles_taiga_id)
    assert OmicsProfiles is not None

    Repurposing_Matrix = tc.get(repurposing_matrix_taiga_id)
    assert Repurposing_Matrix is not None

    OncRef_Matrix = tc.get(prism_oncref_auc_matrix)
    assert OncRef_Matrix is not None

    Model = tc.get(model_taiga_id)
    assert Model is not None

    crispr_summary = ScreenSequenceMap[
        (ScreenSequenceMap.ModelID != "pDNA") & (ScreenSequenceMap.PassesQC)
    ][["ModelID"]].drop_duplicates()
    crispr_summary = crispr_summary.assign(CRISPR=True).set_index("ModelID")
    rnai_summary = pd.merge(
        pd.Series(CL_data_comb.index, name="CCLEName"), Model[["CCLEName", "ModelID"]]
    )
    rnai_summary = (
        rnai_summary.assign(RNAi=True).set_index("ModelID").drop(columns=["CCLEName"])
    )
    omics_summary = OmicsProfiles[["ModelID", "Datatype"]].drop_duplicates()
    omics_summary = pd.pivot(
        omics_summary.assign(value=True),
        index="ModelID",
        columns="Datatype",
        values="value",
    )
    omics_summary = (
        omics_summary.rename(columns=lambda x: x.upper())[["RNA", "WGS", "WES"]]
        .fillna(False)
        .astype(bool)
    )
    omics_summary = omics_summary.rename(columns={"RNA": "RNASeq"})
    repurposing_summary = pd.DataFrame({"depmap_id": Repurposing_Matrix.columns})
    repurposing_summary = repurposing_summary.assign(PRISMRepurposing=True).set_index("depmap_id")

    oncref_summary = pd.DataFrame({"depmap_id": OncRef_Matrix.index})
    oncref_summary = oncref_summary.assign(PRISMOncref=True).set_index("depmap_id")

    overall_summary = pd.concat(
        [oncref_summary, repurposing_summary, omics_summary, rnai_summary, crispr_summary,],
        axis=1,
    )
    overall_summary = overall_summary.fillna(False).astype(bool)
    overall_summary = overall_summary.sort_values(
        ["CRISPR", "RNAi", "RNASeq", "WGS", "WES", "PRISMOncref", "PRISMRepurposing"],
        ascending=False
    )
    overall_summary.index.rename("ModelID", inplace=True)

    # Make sure only ModelIDs that appear in the Model file are included in the final
    # overall_summary data array. Without this filter, an later assertion will break Context
    # Explorer.
    overall_summary = overall_summary[
        overall_summary.index.isin(Model["ModelID"].values)
    ]
    overall_summary.to_csv(out_filename)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("model_taiga_id")
    parser.add_argument("screen_sequence_map_taiga_id")
    parser.add_argument("omics_profiles_taiga_id")
    parser.add_argument("repurposing_matrix_taiga_id")
    parser.add_argument("prism_oncref_auc_matrix")
    parser.add_argument("rnai_taiga_id")
    parser.add_argument("out_filename")
    args = parser.parse_args()
    main(
        args.model_taiga_id,
        args.screen_sequence_map_taiga_id,
        args.omics_profiles_taiga_id,
        args.repurposing_matrix_taiga_id,
        args.prism_oncref_auc_matrix,
        args.rnai_taiga_id,
        args.out_filename,
    )