# r can't write deterministic hdf5 files, and determinism is useful for caching.
# Thus hdf5 files should go through this python cleanup step, even if they already have arxspan ids

import h5py
import pandas as pd


def read_mapping(filename):
    meta = pd.read_csv(filename)
    ccle_to_arxspan_id = {}
    for rec in meta.to_dict("records"):
        ccle_to_arxspan_id[rec["ccle_name"]] = rec["arxspan_id"]
        if pd.isnull(rec["alt_names"]):
            continue
        for name in rec["alt_names"].split(" "):
            if name == "":
                continue
            ccle_to_arxspan_id[name] = rec["arxspan_id"]

    return ccle_to_arxspan_id


def create_floats_uncompressed_hdf5(src_file_name, dest_file_name):
    src = h5py.File(src_file_name, "r")
    dest = h5py.File(dest_file_name, "w")
    # appears to also transpose. That doesn't seem right
    dest["dim_1"] = list(src["dim_0"])
    dest["dim_0"] = list(src["dim_1"])
    array = np.zeros((len(src["dim_0"]), len(src["dim_1"])))
    array[:, :] = src["data"]
    dest.create_dataset("data", dtype="f", compression=None, data=array)
    dest.close()


def assert_all_unique(x):
    assert len(x) == len(set(x))


def rewrite_hdf5(src_filename, dest_filename, transform_dim_0, transform_dim_1):
    "Copies hdf5 matrix, dropping timestamps and applying transform to labels"

    src = h5py.File(src_filename, "r")
    dest = h5py.File(dest_filename, "w")

    dim_0 = [x.decode("utf8") for x in src["dim_0"]]
    dim_1 = [x.decode("utf8") for x in src["dim_1"]]
    data = src["data"]

    print("dim_0", dim_0)
    assert_all_unique(dim_0)
    dim_0 = [transform_dim_0(x) for x in dim_0]
    print("dim_0", dim_0)

    print("dim_1", dim_1)
    assert_all_unique(dim_1)
    dim_1 = [transform_dim_1(x) for x in dim_1]
    print("dim_1", dim_1)

    enc = lambda n: [x.encode("utf8") for x in n]

    dest_dim_0 = dest.create_dataset("dim_0", track_times=False, data=enc(dim_0))
    dest_dim_1 = dest.create_dataset("dim_1", track_times=False, data=enc(dim_1))
    dest.create_dataset("data", track_times=False, data=src["data"])

    dest.close()


def validate_id_format(x):
    # make sure there are no ".1" at the end of any IDs which is often a sign of R
    # appending a suffix for duplicates
    assert not x.endswith(".1"), "{} ends with .1".format(x)
    return x


if __name__ == "__main__":
    import sys
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("src")
    parser.add_argument("dst")
    parser.add_argument("-m", dest="mapping_filename")
    parser.add_argument(
        "--add-arxspan-to-rows", action="store_true", dest="add_arxspan_to_rows"
    )
    parser.add_argument(
        "--add-arxspan-to-cols", action="store_true", dest="add_arxspan_to_cols"
    )

    args = parser.parse_args()

    transform_dim_0 = validate_id_format
    transform_dim_1 = validate_id_format

    identity = lambda x: x

    m = None
    if args.mapping_filename:
        m = read_mapping(args.mapping_filename)

    if args.add_arxspan_to_rows or args.add_arxspan_to_cols:
        assert m is not None

        def map_col(
            x,
        ):  # this appears to thus tolerate whether the cols are ccle names, or already arxspan
            if x in m:
                return m[x]
            else:
                return x

        if args.add_arxspan_to_rows:
            transform_dim_0 = map_col
        if args.add_arxspan_to_cols:
            transform_dim_1 = map_col

    rewrite_hdf5(args.src, args.dst, transform_dim_0, transform_dim_1)
