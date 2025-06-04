from taigapy import create_taiga_client_v3
import pandas as pd
import argparse
import json


def get_id(possible_id, id_key="dataset_id"):
    return None if len(possible_id) == 0 else possible_id[0][id_key]


def main(
    inputs, out_filename,
):
    with open(inputs, "rt") as input_json:
        taiga_ids = json.load(input_json)

    subtype_context_matrix_taiga_id = get_id(
        taiga_ids["subtype_context_matrix_taiga_id"]
    )
    model_taiga_id = get_id(taiga_ids["model_taiga_id"])
    omics_profiles_taiga_id = get_id(taiga_ids["omics_profiles_taiga_id"])
    screen_sequence_map_taiga_id = get_id(taiga_ids["screen_sequence_map_taiga_id"])
    rnai_taiga_id = get_id(taiga_ids["rnai_cell_lines_taiga_id"])
    repurposing_matrix_taiga_id = get_id(taiga_ids["repurposing_matrix_taiga_id"])
    prism_oncref_auc_matrix = get_id(taiga_ids["oncref_auc_taiga_id"])

    tc = create_taiga_client_v3()

    Model = tc.get(model_taiga_id)
    assert Model is not None

    context_matrix = tc.get(subtype_context_matrix_taiga_id)

    overall_summary = pd.DataFrame(
        {"CRISPR": False, "RNAi": False, "PRISMRepurposing": False},
        index=context_matrix.index,
    )
    resulting_cols = ["CRISPR", "RNAi", "WES", "WGS", "RNASeq", "PRISMRepurposing"]

    # CRISPR
    ScreenSequenceMap = tc.get(screen_sequence_map_taiga_id)
    assert ScreenSequenceMap is not None

    crispr_models = ScreenSequenceMap[
        (ScreenSequenceMap.ModelID != "pDNA") & (ScreenSequenceMap.PassesQC)
    ]["ModelID"].drop_duplicates()

    overall_summary.loc[overall_summary.index.isin(crispr_models), "CRISPR"] = True

    # RNAi
    CL_data_comb = tc.get(rnai_taiga_id)
    assert CL_data_comb is not None

    rnai_summary = pd.merge(
        pd.Series(CL_data_comb.index, name="CCLEName"), Model[["CCLEName", "ModelID"]]
    )

    overall_summary.loc[overall_summary.index.isin(rnai_summary.ModelID), "RNAi"] = True

    # PRISM Repurposing
    Repurposing_Matrix = tc.get(repurposing_matrix_taiga_id)
    assert Repurposing_Matrix is not None

    overall_summary.loc[
        overall_summary.index.isin(Repurposing_Matrix.columns), "PRISMRepurposing"
    ] = True

    # PRISM OncRef
    if prism_oncref_auc_matrix is not None:
        OncRef_Matrix = tc.get(prism_oncref_auc_matrix)
        assert OncRef_Matrix is not None

        overall_summary["PRISMOncRef"] = False
        overall_summary.loc[
            overall_summary.index.isin(OncRef_Matrix.index), "PRISMOncRef"
        ] = True
        resulting_cols.insert(
            -1, "PRISMOncRef"
        )  # put the oncref column before the repurposing column

    # OMICS
    OmicsProfiles = tc.get(omics_profiles_taiga_id)
    assert OmicsProfiles is not None

    # if the case is wrong on Datatype, fix it (the new capitalization was introduced 25Q2)
    OmicsProfiles.rename(columns={"DataType": "Datatype"}, inplace=True)
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

    overall_summary = overall_summary.merge(
        omics_summary, how="left", left_index=True, right_index=True
    )

    # Formatting
    overall_summary = (
        overall_summary.fillna(False)
        .astype(bool)
        .loc[context_matrix.index, resulting_cols]
        .sort_values(resulting_cols, ascending=False,)
    )
    overall_summary.index.rename("ModelID", inplace=True)

    assert set(overall_summary.index) == set(
        context_matrix.index
    ), "Models in the data availability matrix must exactly match models in the SubtypeMatrix"

    overall_summary.to_csv(out_filename, index=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("inputs")
    parser.add_argument("out_filename")
    args = parser.parse_args()
    main(
        args.inputs, args.out_filename,
    )
