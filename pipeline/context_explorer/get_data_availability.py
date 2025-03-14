from taigapy import create_taiga_client_v3
import pandas as pd
import argparse
import json


def get_id(possible_id, id_key="dataset_id"):
    return [] if len(possible_id) == 0 else [possible_id[0][id_key]]


def main(
    inputs, out_filename,
):
    with open(inputs, "rt") as input_json:
        taiga_ids = json.load(input_json)

    # If any of these are an empty list and error because of [0], that is a problem. Each
    # of these get_id's should return a list with 1 element.
    model_taiga_id = get_id(taiga_ids["model_taiga_id"])
    omics_profiles_taiga_id = get_id(taiga_ids["omics_profiles_taiga_id"])
    screen_sequence_map_taiga_id = get_id(taiga_ids["screen_sequence_map_taiga_id"])
    rnai_taiga_id = get_id(taiga_ids["rnai_cell_lines_taiga_id"])
    repurposing_matrix_taiga_id = get_id(taiga_ids["repurposing_matrix_taiga_id"])

    # TODO: Use the subtype_context_matrix to add models that don't appear in the above datasets to the
    # output csv.
    subtype_context_matrix_taiga_id = get_id(
        taiga_ids["subtype_context_matrix_taiga_id"]
    )[0]

    # Cannot assume there is an id for oncref
    prism_oncref_auc_matrix = get_id(taiga_ids["prism_oncref_auc_matrix"])

    tc = create_taiga_client_v3()
    # Data for CRISPR, RNAi, Omics, PRISM
    ScreenSequenceMap = tc.get(screen_sequence_map_taiga_id[0])
    assert ScreenSequenceMap is not None

    CL_data_comb = tc.get(rnai_taiga_id[0])
    assert CL_data_comb is not None

    OmicsProfiles = tc.get(omics_profiles_taiga_id[0])
    assert OmicsProfiles is not None

    Repurposing_Matrix = tc.get(repurposing_matrix_taiga_id[0])
    assert Repurposing_Matrix is not None

    OncRef_Matrix = None
    if len(prism_oncref_auc_matrix) > 0:
        OncRef_Matrix = tc.get(prism_oncref_auc_matrix[0])

    Model = tc.get(model_taiga_id[0])
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
    repurposing_summary = repurposing_summary.assign(PRISMRepurposing=True).set_index(
        "depmap_id"
    )

    oncref_summary = None
    if len(prism_oncref_auc_matrix) > 0:
        oncref_summary = pd.DataFrame({"depmap_id": OncRef_Matrix.index})
        oncref_summary = oncref_summary.assign(PRISMOncref=True).set_index("depmap_id")

    # pd.concat should drop any Nones
    overall_summary = pd.concat(
        [
            oncref_summary,
            repurposing_summary,
            omics_summary,
            rnai_summary,
            crispr_summary,
        ],
        axis=1,
    )
    overall_summary = overall_summary.fillna(False).astype(bool)
    overall_summary = overall_summary.sort_values(
        ["CRISPR", "RNAi", "RNASeq", "WGS", "WES", "PRISMOncref", "PRISMRepurposing"],
        ascending=False,
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
    parser.add_argument("inputs")
    parser.add_argument("out_filename")
    args = parser.parse_args()
    main(
        args.inputs, args.out_filename,
    )
