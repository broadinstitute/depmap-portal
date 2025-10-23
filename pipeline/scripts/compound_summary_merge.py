import argparse
import pandas as pd
import numpy as np

import sys

sys.path.append(".")
from hdf5_utils import read_hdf5


def add_brd_prefix_if_necessary(x):
    if x.startswith("PRC-"):
        return "BRD:" + x
    return x


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("predictability_csv")
    parser.add_argument("dataset_matrix_hdf5")
    parser.add_argument("dataset_units")
    parser.add_argument("drug_metadata_csv")
    parser.add_argument("dataset_compound_doses_df")
    parser.add_argument("output_filename")
    args = parser.parse_args()

    pred = pd.read_csv(args.predictability_csv)
    dataset_df = read_hdf5(args.dataset_matrix_hdf5)
    dataset_df.index = [add_brd_prefix_if_necessary(x) for x in dataset_df.index]
    assert sum(dataset_df.index.duplicated()) == 0
    assert sum(dataset_df.columns.duplicated()) == 0
    dataset_units = args.dataset_units

    # keep only the best predictability results
    pred = pred[pred["best"]]

    # keep only the following columns from ensemble predictability results
    pred = pred[["gene", "pearson", "model", "feature0"]]

    # Rename columns
    pred.rename(
        columns={
            "gene": "BroadID",
            "pearson": "PearsonScore",
            "model": "ModelType",
            "feature0": "TopBiomarker",
        },
        inplace=True,
    )
    assert sum(pred["BroadID"].duplicated()) == 0

    drug_metadata = pd.read_csv(args.drug_metadata_csv)
    assert sum(drug_metadata["BroadID"].duplicated()) == 0

    # Filter drug metadata based on whether compound is in predictability compounds
    pred_drug_metadata_cpds = drug_metadata["BroadID"].isin(pred["BroadID"])
    pred_drug_metadata = drug_metadata[pred_drug_metadata_cpds]

    assert (
        len(pred_drug_metadata) > 0
    ), "No drug metadata found for predictability compounds"
    assert sum(pred_drug_metadata["BroadID"].duplicated()) == 0
    # keep only the following columns from drug metadata
    pred_drug_metadata = pred_drug_metadata[
        [
            "BroadID",
            "CompoundName",
            "Synonyms",
            "TargetOrMechanism",
            "GeneSymbolOfTargets",
        ]
    ]
    # Rename columns
    pred_drug_metadata.rename(
        columns={"CompoundName": "Name", "GeneSymbolOfTargets": "Target",},
        inplace=True,
    )

    # Merge the predictability table with the drug metadata
    merged_df = pred.merge(pred_drug_metadata, on="BroadID", how="left")

    # Filter dataset by compound ids in predictability compounds
    dataset_df = dataset_df.loc[pred["BroadID"]]

    # Calculate the bimodality coefficient for each compound row and merge
    cpd_bimodality_coefficients: pd.Series = dataset_df.apply(
        bimodality_coefficient_for_cpd_viabilities, axis=1
    )
    cpd_bimodality_coefficients.name = "BimodalityCoefficient"
    cpd_bimodality_coefficients.index.name = "BroadID"
    assert sum(merged_df["BroadID"].duplicated()) == 0
    merged_df = merged_df.merge(cpd_bimodality_coefficients, how="left", on="BroadID")
    assert sum(merged_df["BroadID"].duplicated()) == 0

    # Calculate sensitive cell lines for each compound and merge
    cpd_sensitive_cell_lines_count = get_sensitive_cell_lines_count(
        dataset_df, dataset_units
    )
    cpd_sensitive_cell_lines_count.name = "NumberOfSensitiveLines"
    cpd_sensitive_cell_lines_count.index.name = "BroadID"
    assert sum(merged_df["BroadID"].duplicated()) == 0
    merged_df = merged_df.merge(
        cpd_sensitive_cell_lines_count, how="left", on="BroadID"
    )
    assert sum(merged_df["BroadID"].duplicated()) == 0

    # Remove the "BRD:" prefix.
    merged_df["BroadID"] = merged_df["BroadID"].str.replace(pat="BRD:", repl="")

    # NOTE: dose df compounds don't have BRD: prefix
    dataset_compound_doses_df = pd.read_csv(args.dataset_compound_doses_df)
    assert sum(merged_df["BroadID"].duplicated()) == 0

    def get_dose_description(df):
        min_dose = df["Dose"].min()
        max_dose = df["Dose"].max()
        if min_dose == max_dose:
            return f"{min_dose}"
        return f"{min_dose}-{max_dose}"

    dataset_compound_doses_df = pd.DataFrame(
        {
            "Dose": dataset_compound_doses_df.groupby("BroadID").apply(
                get_dose_description
            )
        }
    ).reset_index()
    merged_df = merged_df.merge(dataset_compound_doses_df, how="left", on="BroadID")
    assert sum(merged_df["BroadID"].duplicated()) == 0

    # make sure that values in BroadID are unique
    assert sum(merged_df["BroadID"].duplicated()) == 0

    # output to csv file
    merged_df.to_csv(args.output_filename, index=False, na_rep="NA")


def bimodality_coefficient_for_cpd_viabilities(cpd_viabilities: pd.Series) -> pd.Series:
    x = cpd_viabilities.dropna()
    num_viabilities = len(x)
    if num_viabilities > 20:
        s1 = np.mean(x)
        s2 = np.var(x)
        x_ = np.divide(np.subtract(x, s1), np.sqrt(s2))
        s3 = np.mean(np.power(x_, 3))
        s4 = np.mean(np.power(x_, 4))
        n = (1 - np.isnan(x)).sum()
        bimodality_coefficient = (np.power(s3, 2) + 1) / (
            s4 - 3 + 3 * np.power(n - 1, 2) / (np.multiply(n - 2, n - 3))
        )
    else:
        bimodality_coefficient = None

    return bimodality_coefficient


def get_sensitive_cell_lines_count(
    dataset_viabilities_df: pd.DataFrame, units: str
) -> pd.Series:
    """
    Return the number of sensitive cell lines for each compound in the dataset based on a threshold dependent on the dataset units
    """
    threshold_from_units = {
        "log2 fold change": np.log2(0.3),
        "AUC": 0.8,
        "log2(AUC)": np.log2(0.8),
    }
    return dataset_viabilities_df[
        dataset_viabilities_df < threshold_from_units[units]
    ].count(axis="columns")


if __name__ == "__main__":
    main()
