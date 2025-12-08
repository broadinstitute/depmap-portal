import argparse
import pandas as pd
import json

col_order = [
    "subtype_code",
    "out_group",
    "entity_id",
    "dataset",
    "t_pval",
    "t_qval",
    "t_qval_log",
    "mean_in",
    "mean_out",
    "effect_size",
    "selectivity_val",
    "n_dep_in",
    "n_dep_out",
    "frac_dep_in",
    "frac_dep_out",
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input_json")
    parser.add_argument("output")
    args = parser.parse_args()

    # read the list of filenames
    with open(args.input_json) as f:
        filenames = json.load(f)

    # read the csvs
    dfs = []
    for filename in filenames:
        dfs.append(pd.read_csv(filename))

    # combine them into one data frame
    df = pd.concat(dfs, ignore_index=True)

    # order the columns and write it back out
    df[col_order].to_csv(args.output, index=False)


if __name__ == "__main__":
    main()
