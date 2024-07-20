import argparse
import pandas as pd


def main():
    """
    Expand the drug metadata such that each compound of the 'IDs' column which is a list of compound ids are transformed to a row. 'IDs' -> 'BroadID'
    """
    parser = argparse.ArgumentParser()
    parser.add_argument("drug_metadata_df")
    parser.add_argument("output_filename")
    args = parser.parse_args()

    drug_metadata = pd.read_csv(args.drug_metadata_df)
    drug_metadata["SampleIDs"] = drug_metadata["SampleIDs"].str.split(";")
    drug_metadata = drug_metadata.explode("SampleIDs", ignore_index=True)
    drug_metadata.rename(columns={"SampleIDs": "BroadID"}, inplace=True)
    drug_metadata.to_csv(args.output_filename, index=False)


if __name__ == "__main__":
    main()
