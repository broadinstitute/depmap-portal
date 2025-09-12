import argparse
import os

import h5py
import numpy as np
import pandas as pd

# Define reading and writing functions
def write_hdf5(df, filename):
    if os.path.exists(filename):
        os.remove(filename)

    dest = h5py.File(filename, mode="w")

    try:
        dim_0 = [x.encode("utf8") for x in df.index]
        dim_1 = [x.encode("utf8") for x in df.columns]

        dest_dim_0 = dest.create_dataset("dim_0", track_times=False, data=dim_0)
        dest_dim_1 = dest.create_dataset("dim_1", track_times=False, data=dim_1)
        dest.create_dataset("data", track_times=False, data=df.values)
    finally:
        dest.close()


def read_hdf5(filename):
    src = h5py.File(filename, "r")
    try:
        dim_0 = [x.decode("utf8") for x in src["dim_0"]]
        dim_1 = [x.decode("utf8") for x in src["dim_1"]]
        data = np.array(src["data"])
        return pd.DataFrame(index=dim_0, columns=dim_1, data=data)
    finally:
        src.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Convert files from CSV or feather to HDF5 or vice versa."
    )

    parser.add_argument("conversion_type", choices=["to_hdf5", "from_hdf5"])
    parser.add_argument("file_name", type=str, help="File to convert")
    parser.add_argument(
        "file_format",
        choices=["csv", "feather"],
        help="Format of the file to convert or the output file.",
    )
    parser.add_argument("output_file_name", type=str, help="Name for the new HDF5 file")
    parser.add_argument(
        "--transpose", action="store_true", help="Transpose before saving result if set"
    )

    args = parser.parse_args()
    conversion_type = args.conversion_type
    file_name = args.file_name
    file_format = args.file_format
    output_file_name = args.output_file_name

    if conversion_type == "to_hdf5":
        if file_format == "feather":
            df = pd.read_feather(file_name)
            df.set_index(df.columns[0], inplace=True)
            df.index.name = None
        else:
            df = pd.read_csv(file_name, index_col=0)
        df.index = df.index.astype(str)

        if args.transpose:
            df = df.transpose()
        write_hdf5(df, output_file_name)
    else:
        df = read_hdf5(file_name)
        if args.transpose:
            df = df.transpose()
        if file_format == "feather":
            df.reset_index().to_feather(output_file_name)
        else:
            df.to_csv(output_file_name)
