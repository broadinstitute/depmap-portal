# creates auc matrix, and curve params for ingestion
# output:  csv file with dose response curve parameters.  columns = "cell_line_name", "compound_name", "ec50", "slope", "upper_asymptote", "lower_asymptote"

from taigapy import create_taiga_client_v3
import pandas as pd
import numpy as np
import argparse

import sys

sys.path.append(".")
from hdf5_utils import write_hdf5


def validate_data(data: pd.DataFrame):
    expected_columns = [
        "depmap_id",
        "broad_id",
        "auc",
        "ec50",
        "slope",
        "upper_limit",
        "lower_limit",
    ]
    assert all([col in data.columns for col in expected_columns])

    # Check that all compound ids are in the right format
    compound_experiment_id_pattern = r"^BRD-[A-Z]\d{8}-\d{3}-\d{2}-\d$"
    assert data["broad_id"].str.match(compound_experiment_id_pattern).all()


def modify_columns(data: pd.DataFrame) -> pd.DataFrame:
    # rename more columns to be our conventions
    data = data.rename(
        columns={
            "upper_limit": "upper_asymptote",
            "lower_limit": "lower_asymptote",
            "depmap_id": "cell_line_name",
        },
    )
    data["slope"] = -1 * data["slope"]
    data["compound_name"] = "BRD:" + data["broad_id"]

    # ID for the compound instead of compound experiment/sample
    data["truncated_broad_id"] = data["broad_id"].str[:13]

    # Assign highest priority to the newest screen
    screen_priority = ["MTS010", "MTS006", "MTS005", "HTS002"]
    screen_priority_index = dict(zip(screen_priority, range(len(screen_priority))))
    data["screen_priority"] = data["screen_id"].map(screen_priority_index)

    return data


def filter_rows(data: pd.DataFrame) -> pd.DataFrame:
    # drop rows with no cell line
    data = data.dropna(subset=["cell_line_name"])

    # drop rows if cell line did not pass STR profiling
    data = data[data["passed_str_profiling"]]

    # if there are values for both P500 and P300, use the P500 ones
    data = data.sort_values("row_name", ascending=False).drop_duplicates(
        ["broad_id", "cell_line_name", "screen_id"], keep="first"
    )

    # find compounds in both HTS and MTS and drop all HTS samples
    compounds_in_mts_and_hts = data[
        data.duplicated(["truncated_broad_id", "cell_line_name"], False)
        & (data["screen_priority"] == 3)
    ]["truncated_broad_id"].unique()
    data = data[
        ~(
            data["truncated_broad_id"].isin(compounds_in_mts_and_hts)
            & (data["screen_priority"] == 3)
        )
    ]

    # for compound experiments in multiple MTS screens, only keep the ones with highest screen priority
    data = data[
        data.screen_priority
        # See https://stackoverflow.com/a/27987908/12150367 for explanation of the following
        == data.groupby(
            ["cell_line_name", "truncated_broad_id"]
        ).screen_priority.transform(min)
    ]

    # we are fixing the upper asymptote at 1, but the lower asymptote has no limit
    # the 'bad' looking curves are often those with viabilities > 1 which causes the
    # lower asymtote to drift up. We drop these from the portal's version so that
    # users can see the raw points but not curve that we believe is invalid.
    data = data[data["lower_asymptote"] <= 1]

    return data


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "taiga_id", type=str, help="taiga id of the repurposing dosecurves dataset"
    )
    args = parser.parse_args()

    # load data from taiga
    tc = create_taiga_client_v3()

    data = tc.get(args.taiga_id)

    validate_data(data)
    data = modify_columns(data)
    data = filter_rows(data)

    # Write AUC values
    auc_mat = data.pivot(index="compound_name", columns="cell_line_name", values="auc")
    write_hdf5(auc_mat, "auc.hdf5")

    # Write dose curve parameter values
    dose_curve_parameters = data.filter(
        [
            "cell_line_name",
            "compound_name",
            "ec50",
            "slope",
            "upper_asymptote",
            "lower_asymptote",
        ]
    )  # only use our convention columns
    dose_curve_parameters.to_csv("curves.csv")
