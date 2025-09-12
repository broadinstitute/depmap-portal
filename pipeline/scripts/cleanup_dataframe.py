import argparse
import pandas as pd


def int_or_str(s: str):
    if s.isdecimal():
        return int(s)
    return s


def clean_dataframe(filename, index_col, input_format, output_format):
    if input_format == "csv":
        df = pd.read_csv(filename, index_col=index_col)

    df.sort_index(inplace=True, axis=1)

    if index_col is None:
        df.sort_values(df.columns.tolist(), inplace=True)
    else:
        df.sort_index(inplace=True)

    if output_format == "csv":
        df.to_csv(filename, index=False if index_col is None else True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Standardize format for a DataFrame.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("filename", type=str, help="Name of file to clean.")
    parser.add_argument(
        "--index_col",
        type=int_or_str,
        default=None,
        help="Column to use as the row labels of the DataFrame, given either as string name or column index. Will assume string of numbers is column index.",
    )
    parser.add_argument(
        "--input_format",
        default="csv",
        const="csv",
        nargs="?",
        choices=["csv"],
        help="Format of the input file.",
    )
    parser.add_argument(
        "--output_format",
        default="csv",
        const="csv",
        nargs="?",
        choices=["csv"],
        help="Format of the output file.",
    )
    args = parser.parse_args()

    clean_dataframe(
        args.filename, args.index_col, args.input_format, args.output_format
    )
