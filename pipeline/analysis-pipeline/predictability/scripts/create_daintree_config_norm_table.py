# usage: create_daintree_config_norm_table.py [input.json] [output.csv]
# This script will:
# parse the json file to get a list of artifacts
# for each artifact:
#    read the json file feature_imp_norm_filename and create a row from it's contents
# concat all rows and write to a csv file output.csv
import argparse
import csv
import json


def create_norm_table(artifacts_file, output_file):
    with open(artifacts_file, "rt") as fd:
        artifacts = json.load(fd)

    rows = []
    for artifact in artifacts:
        with open(artifact["feature_imp_norm_filename"], "rt") as fd:
            norms = json.load(fd)

        # parameters shared by every model in the file
        params = {k: v for k, v in norms.items() if k != "models"}

        # one row per model (feature set) in the file
        for model_key, stats in norms["models"].items():
            rows.append(
                {
                    "model_name": artifact["model_name"],
                    "screen_name": artifact["screen_name"],
                    "feature_set": model_key,
                    **stats,
                    **params,
                }
            )

    # preserve first-seen column order across all rows
    with open(output_file, "wt", newline="") as fd:
        writer = csv.DictWriter(fd, fieldnames=sorted(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("artifacts_file")
    parser.add_argument("output_file")
    args = parser.parse_args()

    create_norm_table(args.artifacts_file, args.output_file)


if __name__ == "__main__":
    main()
