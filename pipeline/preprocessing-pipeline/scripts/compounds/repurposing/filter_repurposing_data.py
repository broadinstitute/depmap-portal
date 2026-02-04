import argparse
import json
import pandas as pd
import numpy as np
from typing import List

from taigapy import create_taiga_client_v3


def validate_data(treatment_info: pd.DataFrame, screens: List[str]):
    # Check that all compound ids are in the right format
    compound_experiment_id_pattern = r"^BRD-[A-Z]\d{8}-\d{3}-\d{2}-\d$"
    assert treatment_info["broad_id"].str.match(compound_experiment_id_pattern).all()

    # Sorting by screen ID assumes this is true. MTS > HTS, higher numbers > lower numbers
    screen_id_pattern = r"^([MH]TS\d{3})|(HTS)$"
    assert treatment_info["screen_id"].str.match(screen_id_pattern).all()


def filter_rescreened_compounds(
    data: pd.DataFrame, treatment_info: pd.DataFrame, hts_screens: List[str],
):
    # ID for the compound instead of compound experiment/sample
    treatment_info["truncated_broad_id"] = treatment_info["broad_id"].str[:13]

    # For compounds that were in mulitple screens, only take rows for the latest screen.
    treatment_info = treatment_info[
        treatment_info.screen_id
        # See https://stackoverflow.com/a/27987908/12150367 for explanation of the following
        == treatment_info.groupby(["truncated_broad_id"]).screen_id.transform(max)
    ]
    data = data.filter(treatment_info["column_name"].unique(), axis="columns")
    return data


def filter_valid_cell_lines(
    data: pd.DataFrame, cell_line_info: pd.DataFrame,
):
    # Drop cell lines that did not pass STR profiling
    # and rows without cell line info
    valid_cell_lines = cell_line_info[
        cell_line_info["passed_str_profiling"] == True
    ].dropna(subset=["depmap_id"])

    valid_cell_lines.sort_values("row_name", ascending=False, inplace=True)
    valid_cell_lines.drop_duplicates("depmap_id", inplace=True)

    data = data.filter(valid_cell_lines["row_name"].unique(), axis="index")
    data.index = data.index.map(valid_cell_lines.set_index("row_name")["depmap_id"])
    return data


def filter_duplicate_screens(treatment_info: pd.DataFrame):
    # For cell lines with both PR300 and PR500, choose PR500
    # (only applies to secondary, this is a no op primary)
    if (
        not treatment_info["column_name"].is_unique
    ) and "compound_plate" in treatment_info.columns:
        treatment_info = treatment_info.sort_values(
            ["compound_plate"], ascending=False
        ).drop_duplicates(["column_name"])

    return treatment_info


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("taiga_id", type=str)
    parser.add_argument("treatment_info_taiga_id", type=str)
    parser.add_argument("cell_line_info_taiga_id", type=str)
    parser.add_argument("--screens", nargs="+", type=str)
    args = parser.parse_args()

    tc = create_taiga_client_v3()

    data = tc.get(args.taiga_id)
    treatment_info = tc.get(args.treatment_info_taiga_id)
    cell_line_info = tc.get(args.cell_line_info_taiga_id)
    screens = args.screens

    validate_data(treatment_info, screens)

    filtered_data = filter_rescreened_compounds(data, treatment_info, screens)

    filtered_data = filter_valid_cell_lines(filtered_data, cell_line_info)

    keep_columns = treatment_info["column_name"].isin(filtered_data.columns)
    filtered_treatment_info = treatment_info[keep_columns]
    filtered_treatment_info = filter_duplicate_screens(filtered_treatment_info)

    filtered_data.to_csv("filtered_data.csv")

    keep_columns = treatment_info["column_name"].isin(filtered_data.columns)
    filtered_treatment_info = treatment_info[keep_columns]
    filtered_treatment_info.to_csv("filtered_treatment_info.csv", index=False)

    dropped = treatment_info[~keep_columns]["column_name"].tolist()

    with open("dropped.json", "w") as fd:
        fd.write(json.dumps(dropped))
