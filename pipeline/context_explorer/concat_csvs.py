import argparser
import pandas as pd


def main():
    parser = argparser.ArgumentParser()
    parser.add_argument("input_json")
    parser.add_argument("output")
    args = parser.parse_args()
    with open(args.input_json) as f:
        filenames = json.load(f)
    dfs = []
    for filename in filenames:
        dfs.append(pd.read_csv(filename))
    pd.concat(dfs, ignore_index=True).to_csv(args.output, index=False)


if __name__ == "__main__":
    main()
