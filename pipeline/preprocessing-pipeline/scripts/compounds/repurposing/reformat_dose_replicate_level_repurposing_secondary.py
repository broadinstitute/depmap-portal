# reformats files, including changing log to just viability
# output is a csv file with the columns: 'cell_line_name', 'compound_name', 'replicate', 'masked', 'dose', 'viability'
import argparse
import pandas as pd


def reformatted_dose_replicate_level(
    data_filename: str, treatment_info_filename: str
) -> pd.DataFrame:
    data = pd.read_csv(data_filename, index_col=0)

    replicate_inst_info = pd.read_csv(treatment_info_filename)

    stacked = data.stack().reset_index()
    stacked.columns = ["cell_line_name", "column_name", "viability"]

    stacked = stacked.merge(
        replicate_inst_info[["column_name", "broad_id", "dose"]], on="column_name"
    )

    stacked["compound_name"] = "BRD:" + stacked["broad_id"]

    # to add:  'replicate' and 'masked'
    # replicate column:  replicates have the same cell line, compound, and dose
    stacked["replicate"] = (
        stacked.groupby(["cell_line_name", "compound_name", "dose"]).cumcount() + 1
    )
    stacked["viability"] = 2 ** stacked["viability"]  # transform log to just viability
    stacked["masked"] = "F"
    stacked = stacked[
        ["cell_line_name", "compound_name", "replicate", "masked", "dose", "viability"]
    ]

    return stacked


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("data_filename", type=str)
    parser.add_argument("treatment_info_filename")
    args = parser.parse_args()

    melted = reformatted_dose_replicate_level(
        args.data_filename, args.treatment_info_filename
    )
    melted.to_csv(
        "reformatted_dose_replicate_level_secondary_screen_repurposing_data.csv",
        index=False,
    )
