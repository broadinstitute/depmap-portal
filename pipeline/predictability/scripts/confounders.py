import argparse

# import numpy as np
import pandas as pd
from taigapy import create_taiga_client_v3


def encode_one_hot(col_prefix, values):
    # given "values" (a pandas.Series) containing strings, create a pandas.DataFrame with column
    # per value with one-hot encoding

    cols = {}
    for value in values.unique():
        cols[col_prefix + str(value).replace("-", "")] = [
            1 if x == value else 0 for x in values
        ]

    return pd.DataFrame(cols, index=values.index)


def get_growth_pattern_per_model(models):
    models.index = models["ModelID"]
    return encode_one_hot(
        "GrowthPattern",
        models["GrowthPattern"].map(lambda x: "Unknown" if x is None else x),
    )


def get_qc_confounders_table(achilles_screen_qc_report, crispr_map):
    # create confounder table indexed by screen_id
    qc = achilles_screen_qc_report.merge(crispr_map)
    qc.index = qc["ScreenID"]

    return pd.concat(
        [
            qc,
            encode_one_hot("ScreenType", qc["ScreenType"]),
            encode_one_hot("Library", qc["Library"]),
        ],
        axis=1,
    )


def collapse_confounders_to_models(qc):
    possible_categorical_columns = [
        "ModelID",
        "LibraryAvana",
        "LibraryHumagneCD",
        "LibraryKY",
        "ScreenType2DS",
        "ScreenType3DO",
    ]

    # LibraryHumagneCD and ScreenType3D0 are not included in public 22q4
    actual_categorical_columns = []
    for col in possible_categorical_columns:
        if col in qc.columns:
            actual_categorical_columns.append(col)

    continuous_variables = []
    for name, dtype in zip(qc.columns, qc.dtypes):
        if dtype.kind == "f":
            continuous_variables.append(name)

    return pd.concat(
        [
            # take the mean of all continuous variables
            qc[(["ModelID"] + continuous_variables)].groupby("ModelID").mean(),
            # and take the max of all categorical variables
            qc[actual_categorical_columns].groupby("ModelID").max(),
        ],
        axis=1,
    )


if __name__ == "__main__":
    tc = create_taiga_client_v3()

    parser = argparse.ArgumentParser()
    parser.add_argument("models_taiga_id", type=str)
    parser.add_argument("achilles_screen_qc_report_id", type=str)
    parser.add_argument("crispr_map_id", type=str)

    args = parser.parse_args()

    models = tc.get(args.models_taiga_id)
    achilles_screen_qc_report = tc.get(args.achilles_screen_qc_report_id)
    crispr_map = tc.get(args.crispr_map_id)

    confounders_per_screen = get_qc_confounders_table(
        achilles_screen_qc_report, crispr_map
    )

    confounders_per_model = collapse_confounders_to_models(confounders_per_screen)

    growth_pattern_per_model = get_growth_pattern_per_model(models)

    all_confounders_per_model = pd.concat(
        [confounders_per_model, growth_pattern_per_model], axis=1
    )

    all_confounders_per_model.to_csv("confounders.csv")
