import json
import os
import argparse
import pandas as pd

column_names = "feature_name,feature_label,given_id,taiga_id,dim_type".split(",")

def merge(artifacts_file, output_file):
    with open(artifacts_file, "rt") as fd:
        artifacts = json.load(fd)

    list_of_files = [artifact['features_metadata_filename'] for artifact in artifacts]
    dfs = [pd.read_csv(filename)[column_names] for filename in list_of_files]
    merged = pd.concat(dfs, ignore_index=True).drop_duplicates()
    assert sum(merged["feature_name"].duplicated()) == 0
    merged.to_csv(output_file, index=False)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("artifacts_file")
    parser.add_argument("output_file")
    args = parser.parse_args()

    merge(args.artifacts_file, args.output_file)

if __name__ == "__main__":
    main()