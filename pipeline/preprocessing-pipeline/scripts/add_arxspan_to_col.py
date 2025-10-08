import csv
import sys
import os

sys.path.append(os.path.dirname(__file__))
from cleanup_hdf5 import read_mapping


def rewrite_column(src, dst, column_name, dest_column_name, filename):
    m = read_mapping(filename)

    def map_ccle_name(x):
        if x in m:
            return m[x]
        else:
            return "UNKNOWN-{}".format(x)

    with open(dst, "wt") as fdo:
        w = csv.writer(fdo)
        with open(src, "rt") as fdi:
            r = csv.reader(fdi)
            header = next(r)

            try:
                column_index = header.index(column_name)
            except ValueError:
                raise Exception(
                    "could not find {} among {}".format(column_name, header)
                )
            assert column_index >= 0

            header = list(header) + [dest_column_name]

            w.writerow(header)
            for row in r:
                w.writerow(list(row) + [map_ccle_name(row[column_index])])


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("src")
    parser.add_argument("column")
    parser.add_argument("dst")
    parser.add_argument("dstcol")
    parser.add_argument("mapping_filename")

    args = parser.parse_args()

    rewrite_column(args.src, args.dst, args.column, args.dstcol, args.mapping_filename)
