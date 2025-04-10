import pandas as pd
import importlib

# Import the necessary matplotlib plotting module natively(at this moment without this import the density
# function calculation causes a matplotlib import error)
importlib.import_module("pandas.plotting._matplotlib")


def calculate_common_essential_genes(in_file: str, out_file: str) -> pd.DataFrame:
    """
    Calculate common essential genes based on percentile rank analysis.
    """

    data = pd.read_csv(in_file, index_col="Row.name")

    # Rank the data across rows (axis=1), treating NA/null values as lowest rank resulting in those NA data points having
    # the highest values. e.g. [1, 2, NA, NA] -> [1, 2, 3, 3].
    # However, in R's case(from the previous R script) the example would become [1, 2, 3, 4]
    rank_data = data.rank(axis=1, method="min", na_option="bottom")

    # Divide by the number of non-NA values for each row to normalize
    rank_data = rank_data.div(data.notna().sum(axis=1), axis=0)

    # Compute the 90th percentile for each column in the DataFrame
    percentile = rank_data.quantile(q=0.9)

    # Calculate the density function of the 90th percentile values
    dens = pd.Series(percentile).plot.density(bw_method=0.3).get_lines()[0].get_xydata()
    dens_df = pd.DataFrame(dens, columns=["x", "y"])

    # Filter out the values that are not between 0.1 and 0.9
    df_range = dens_df[(dens_df["x"] > 0.1) & (dens_df["x"] < 0.9)]

    # Find the x value that corresponds to the minimum y value in the filtered DataFrame
    threshold = df_range.loc[df_range["y"].idxmin(), "x"]
    ce_df = pd.DataFrame(
        {"Row.name": percentile.index, "CE_percentile": percentile.values}
    )

    # Add a boolean column to the DataFrame that indicates whether the CE_percentile value is <= to the threshold
    ce_df["Common_Essential"] = ce_df["CE_percentile"] <= threshold

    ce_df.to_csv(out_file, index=False)

    return ce_df


def get_common_essential_genes_for_chronos_combined(
    crispr_inferred_ce_df: pd.DataFrame, out_file: str
) -> pd.DataFrame:
    """
    Get the common essential genes for Chronos_Combined and format it so that 
    it can be merged with the other data
    """
    crispr_inferred_ce_df.rename(columns={"Essentials": "Row.name"}, inplace=True)
    crispr_inferred_ce_df["Common_Essential"] = True

    crispr_inferred_ce_df.to_csv(out_file, index=False)

    return crispr_inferred_ce_df


if __name__ == "__main__":
    import sys
    from taigapy import create_taiga_client_v3

    if len(sys.argv) != 5:
        print(
            "Need at least 4 arguments: data_label, crispr_inferred_common_essentials_taiga_id, non_crispr_input_data_file, out_file"
        )
        sys.exit(1)

    data_label = sys.argv[1]
    crispr_inferred_common_essentials_taiga_id = sys.argv[2]
    non_crispr_input_data_file = sys.argv[3]
    out_file = sys.argv[4]

    # Crispr is retreived from taiga
    # Non-crispr is calculated from the data file
    if data_label == "Chronos_Combined":
        tc = create_taiga_client_v3()
        crispr_inferred_common_essentials_df = tc.get(
            crispr_inferred_common_essentials_taiga_id
        )
        get_common_essential_genes_for_chronos_combined(
            crispr_inferred_common_essentials_df, out_file
        )
    else:
        calculate_common_essential_genes(non_crispr_input_data_file, out_file)
