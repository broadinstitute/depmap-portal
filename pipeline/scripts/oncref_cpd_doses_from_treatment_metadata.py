import argparse
from taigapy import TaigaClient

tc = TaigaClient()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("treatment_taiga_id")
    parser.add_argument("output_filename")
    args = parser.parse_args()

    # 5702 rows
    oncref_conditions = tc.get(args.treatment_taiga_id)
    # 896 rows
    oncref_conditions.drop_duplicates(subset=["SampleID", "Dose"], inplace=True)
    oncref_conditions_df = oncref_conditions[["SampleID", "Dose"]]
    oncref_conditions_df = oncref_conditions_df.rename(
        columns={"SampleID": "BroadID"}
    )  # Dose is already in the right format
    oncref_conditions_df.to_csv(args.output_filename, index=False)


if __name__ == "__main__":
    main()
