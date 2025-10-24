import argparse
import pandas as pd
from taigapy import create_taiga_client_v3
import os

cell_lines_arxspan = [
    "ACH-000014",
    "ACH-000052",
    "ACH-000279",
    "ACH-000552",
    "ACH-000788",
    "ACH-000580",
    "ACH-001001",
    "ACH-000210",
    "ACH-000458",
    "ACH-000805",
    "ACH-000706",
    "ACH-000585",
    "ACH-000425",  # UACC62_SKIN
    "ACH-000810",
    "ACH-000899",
    "ACH-001170",
    "ACH-001205",
    "ACH-000304",
    "ACH-000441",
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("release_taiga_id")
    parser.add_argument("repurposing_taiga_id")
    parser.add_argument("rnai_taiga_id")
    parser.add_argument("dest")
    parser.add_argument("file_name")
    args = parser.parse_args()
    release_taiga_id = args.release_taiga_id
    repurposing_taiga_id = args.repurposing_taiga_id
    rnai_taiga_id = args.rnai_taiga_id
    dest = args.dest
    file_name = args.file_name
    out_filename = os.path.join(dest, file_name)

    tc = create_taiga_client_v3()
    # Data for CRISPR, RNAi, Omics, PRISM
    ScreenSequenceMap = tc.get(f"{release_taiga_id}/ScreenSequenceMap")
    ScreenSequenceMap = ScreenSequenceMap[
        ScreenSequenceMap["ModelID"].isin(cell_lines_arxspan)
    ]
    assert ScreenSequenceMap is not None

    CL_data_comb = tc.get(rnai_taiga_id)
    assert CL_data_comb is not None

    OmicsProfiles = tc.get(f"{release_taiga_id}/OmicsProfiles")
    OmicsProfiles = OmicsProfiles[OmicsProfiles["ModelID"].isin(cell_lines_arxspan)]
    assert OmicsProfiles is not None

    Repurposing_23Q2_Cell_Line_Meta_Data = tc.get(repurposing_taiga_id)
    Repurposing_23Q2_Cell_Line_Meta_Data = Repurposing_23Q2_Cell_Line_Meta_Data[
        Repurposing_23Q2_Cell_Line_Meta_Data["depmap_id"].isin(cell_lines_arxspan)
    ]
    assert Repurposing_23Q2_Cell_Line_Meta_Data is not None

    Model = tc.get(f"{release_taiga_id}/Model")
    Model = Model[Model["ModelID"].isin(cell_lines_arxspan)]
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
    prism_summary = Repurposing_23Q2_Cell_Line_Meta_Data[
        ~Repurposing_23Q2_Cell_Line_Meta_Data["depmap_id"].str.contains(
            "prism invariant"
        )
    ][["depmap_id"]].drop_duplicates()

    prism_summary = prism_summary.assign(PRISM=True).set_index("depmap_id")
    overall_summary = pd.concat(
        [prism_summary, omics_summary, rnai_summary, crispr_summary,], axis=1,
    )
    overall_summary = overall_summary.fillna(False).astype(bool)
    overall_summary = overall_summary.sort_values(
        ["CRISPR", "RNAi", "RNASeq", "WGS", "WES", "PRISM"], ascending=False
    )
    overall_summary.index.rename("ModelID", inplace=True)
    overall_summary.to_csv(out_filename)


if __name__ == "__main__":
    main()
