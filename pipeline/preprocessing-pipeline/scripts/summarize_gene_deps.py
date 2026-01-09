import pandas as pd
import re
import sys


def extract_gene_id(gene_string: str) -> str:
    """
    Extracts gene IDs from a string using regular expressions
    """
    return re.sub(r".*\(([0-9]+)\)", r"\1", gene_string)


def load_data(args: dict) -> tuple:
    """
    Load the data from the input files
    """
    lrt = pd.read_csv(args["lrt"])
    ce = pd.read_csv(args["common_essentials"])
    moments = pd.read_csv(args["moments"])
    depcounts = pd.read_csv(args["depcounts"])
    return lrt, ce, moments, depcounts


def merge_and_filter_data(
    lrt: pd.DataFrame, ce: pd.DataFrame, moments: pd.DataFrame, depcounts: pd.DataFrame
) -> pd.DataFrame:
    """
    Merge the data from the input files and filter out rows where 
    both "is_strongly_selective" and "is_common_essential" are NA
    """
    # Merge the three DataFrames on the "Row.name" and "label" columns
    merged_df = pd.merge(lrt, moments, on=["Row.name", "label"])
    merged_df = pd.merge(merged_df, ce, on=["Row.name", "label"])

    analysis_df = pd.DataFrame(
        {
            "label": merged_df["label"],
            "gene": merged_df["Row.name"],
            "is_common_essential": merged_df["Common_Essential"],
            "skewness": merged_df["Skewness"],
            "kurtosis": merged_df["Kurtosis"],
        }
    )

    # Extract gene IDs from the gene column and add a new column, gene_id
    # to both depcounts and analysis_df
    depcounts["gene_id"] = depcounts["gene"].apply(extract_gene_id)
    analysis_df["gene_id"] = analysis_df["gene"].apply(extract_gene_id)

    # Merge depcounts and analysis_df on the "gene_id" and "label" columns
    final_df = pd.merge(depcounts, analysis_df, on=["gene_id", "label"])
    final_df.drop(columns=["gene_x", "gene_y"], inplace=True)

    final_df["is_strongly_selective"] = (
        final_df["skewness"] * final_df["kurtosis"] < -0.86
    ) & (final_df["dep_lines"] > 0)

    # if we don't have at least some genes which are strongly selective something has gone very wrong.
    # Similarly all is also a problem
    strongly_selective_fraction = sum(final_df["is_strongly_selective"]) / len(
        analysis_df
    )
    assert strongly_selective_fraction > 0.01 and strongly_selective_fraction < 0.99

    # similar for common essential genes
    common_essential_fraction = sum(final_df["is_common_essential"]) / len(analysis_df)
    assert common_essential_fraction > 0.01 and common_essential_fraction < 0.99

    # Filter out rows where both "is_strongly_selective" and "is_common_essential" are NA
    final_df = final_df[
        ~(
            final_df["is_strongly_selective"].isna()
            & final_df["is_common_essential"].isna()
        )
    ]

    unique_rows = final_df[["gene_id", "label"]].drop_duplicates()
    num_unique_rows = len(unique_rows)
    assert num_unique_rows == len(final_df)

    expected_columns = [
        "gene_id",
        "label",
        "dep_lines",
        "lines_with_data",
        "is_strongly_selective",
        "is_common_essential",
    ]
    assert set(expected_columns).issubset(
        set(final_df.columns)
    ), "Missing expected columns in final DataFrame."

    final_df = final_df[expected_columns]
    assert not final_df.isnull().values.any(), "NaN values found in final DataFrame."

    return final_df


def save_data(final_df, args):
    """
    Save the final DataFrame to the output file
    """
    final_df.to_csv(args["output"], index=False)


def main():
    # Parse command line arguments and create a dictionary mapping each key to its corresponding value
    # e.g. python3 {{ inputs.summarize_gene_deps.filename }} common_essentials=common_essentials.csv \
    #         moments=moments.csv lrt=lrt.csv depcounts=depcounts.csv output=summary.csv
    args = dict([arg.split("=") for arg in sys.argv[1:]])
    lrt, ce, moments, depcounts = load_data(args)
    final_df = merge_and_filter_data(lrt, ce, moments, depcounts)
    save_data(final_df, args)


# Check that the right number of command line arguments are present
if len(sys.argv) < 4:
    raise Exception(
        "Usage: python3 summarize_gene_deps.py lrt=... common_essentials=... output=..."
    )
else:
    main()
