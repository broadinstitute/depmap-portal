from taigapy import create_taiga_client_v3
import argparse
import pandas as pd
import json


# This function takes a parameter named "threshold" which is the probability threshold from the dataset so that we can
# count the number of lines that are above that threshold. e.g. > 0.9 for the strong depCL count column in tda table
def count_dep_lines(probs, threshold):
    dep_lines = (probs > threshold).apply(sum)
    lines_with_data = (~pd.isna(probs)).apply(sum)
    merged = pd.DataFrame(dict(dep_lines=dep_lines, lines_with_data=lines_with_data))
    merged.index.name = "gene"
    return merged


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("artifacts", help="json file containing artifacts")
    parser.add_argument("output", help="Path to write the output")
    parser.add_argument(
        "threshold",
        type=float,
        default=0.5,
        nargs="?",
        help="Threshold for probability of dependency",
    )
    args = parser.parse_args()

    tc = create_taiga_client_v3()

    with open(args.artifacts, "rt") as fd:
        artifacts = json.load(fd)
    counts_list = []
    for artifact in artifacts:
        probs = tc.get(artifact["dataset_id"])
        counts = count_dep_lines(probs, args.threshold)
        counts["label"] = artifact["label"]
        counts_list.append(counts)

    all_counts = pd.concat(counts_list)

    all_counts.to_csv(args.output)


if __name__ == "__main__":
    main()
