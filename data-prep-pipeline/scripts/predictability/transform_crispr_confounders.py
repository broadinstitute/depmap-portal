import argparse
import pandas as pd
from taigapy import create_taiga_client_v3


def encode_one_hot(col_prefix: str, values: pd.Series) -> pd.DataFrame:
    # given "values" (a pandas.Series) containing strings, create a pandas.DataFrame with column
    # per value with one-hot encoding

    cols = {}
    for value in values.unique():
        cols[col_prefix + str(value).replace("-", "")] = [
            1 if x == value else 0 for x in values
        ]

    return pd.DataFrame(cols, index=values.index)


def get_growth_pattern_per_model(models: pd.DataFrame) -> pd.DataFrame:
    models.index = models["ModelID"]
    return encode_one_hot(
        "GrowthPattern",
        models["GrowthPattern"].map(lambda x: "Unknown" if x is None else x),
    )


def get_qc_confounders_table(
    achilles_screen_qc_report: pd.DataFrame, crispr_map: pd.DataFrame
) -> pd.DataFrame:
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


def collapse_confounders_to_models(qc: pd.DataFrame) -> pd.DataFrame:
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


def generate_crispr_confounders_matrix(
    models: pd.DataFrame,
    achilles_screen_qc_report: pd.DataFrame,
    crispr_map: pd.DataFrame,
) -> pd.DataFrame:
    confounders_per_screen = get_qc_confounders_table(
        achilles_screen_qc_report, crispr_map
    )

    confounders_per_model = collapse_confounders_to_models(confounders_per_screen)

    growth_pattern_per_model = get_growth_pattern_per_model(models)

    all_confounders_per_model = pd.concat(
        [confounders_per_model, growth_pattern_per_model], axis=1
    )

    return all_confounders_per_model


def process_and_generate_crispr_confounders(
    model_taiga_id: str,
    achilles_screen_qc_report_taiga_id: str,
    crispr_screen_map_taiga_id: str,
) -> pd.DataFrame:
    tc = create_taiga_client_v3()

    print("Getting CRISPR confounders source data...")
    models = tc.get(model_taiga_id)
    achilles_screen_qc_report = tc.get(achilles_screen_qc_report_taiga_id)
    crispr_map = tc.get(crispr_screen_map_taiga_id)

    print("Transforming CRISPR confounders data...")
    crispr_confounder_matrix = generate_crispr_confounders_matrix(
        models, achilles_screen_qc_report, crispr_map
    )
    print("Transformed CRISPR confounders data")

    return crispr_confounder_matrix


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate CRISPR confounder matrix for predictability"
    )
    parser.add_argument("model_taiga_id", help="Taiga ID of model data")
    parser.add_argument(
        "achilles_screen_qc_report_taiga_id",
        help="Taiga ID of Achilles screen QC report",
    )
    parser.add_argument(
        "crispr_screen_map_taiga_id", help="Taiga ID of CRISPR screen map"
    )
    parser.add_argument("output", help="Path to write the output")
    args = parser.parse_args()
    crispr_confounder_matrix = process_and_generate_crispr_confounders(
        args.model_taiga_id,
        args.achilles_screen_qc_report_taiga_id,
        args.crispr_screen_map_taiga_id,
    )
    if crispr_confounder_matrix is not None:
        crispr_confounder_matrix.to_csv(args.output)
