import argparse

import pandas as pd

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("completed_jobs")
    parser.add_argument("partitions")
    parser.add_argument("features_suffix")
    parser.add_argument("predictions_suffix")

    args = parser.parse_args()

    with open(args.completed_jobs) as f:
        completed_jobs = {l.split("/")[-1].strip() for l in f.readlines()}

    partitions = pd.read_csv(args.partitions)
    partitions["path_prefix"] = (
        partitions["model"]
        + "_"
        + partitions["start"].map(str)
        + "_"
        + partitions["end"].map(str)
        + "_"
    )
    partitions["feature_path"] = partitions["path_prefix"] + args.features_suffix
    partitions["predictions_path"] = partitions["path_prefix"] + args.predictions_suffix

    assert len(set(partitions["feature_path"]) - completed_jobs) == 0
    assert len(set(partitions["predictions_path"]) - completed_jobs) == 0
