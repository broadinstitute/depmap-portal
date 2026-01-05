import os
import json
import argparse
import hashlib
import pandas as pd
import numpy as np


def hash_from_file(filename):
    h = hashlib.sha256()
    with open(filename, "rb") as fd:
        for chunk in iter(lambda: fd.read(100000), b""):
            h.update(chunk)
    return h.hexdigest()


def hash_from_featherfile(filename):
    df = pd.read_feather(filename)
    h = hashlib.sha256()

    float_cols = []
    int_cols = []
    bool_cols = []
    for column, column_dtype, column_i in zip(
        df.columns, df.dtypes, range(len(df.columns))
    ):
        h.update(column.encode("utf8"))
        if column_dtype == np.float64:
            # collect all the float columns together because calling to_numpy() once
            # is appears to be much faster then calling it once per column
            float_cols.append(column_i)
        elif column_dtype.kind == "O":
            for x in df[column]:
                assert isinstance(x, str) or x is None
            column_bytes = (str(list(df[column]))).encode(
                "utf8"
            )  # arbitrarily chosen encoding of list of str -> bytes
        elif column_dtype.kind == "i":
            int_cols.append(column_i)
        elif column_dtype.kind == "b":
            bool_cols.append(column_i)
        else:
            #            import pdb
            #            pdb.set_trace()
            raise Exception(
                f"column_dtype not an np.object nor a np.float64. column_dtype={column_dtype}"
            )

    # now add all float columns to hash in bulk
    h.update(df.iloc[:, float_cols].to_numpy(float).tobytes())
    h.update(df.iloc[:, int_cols].to_numpy(int, na_value=888888888).tobytes())
    h.update(df.iloc[:, bool_cols].to_numpy(bool).tobytes())

    return h.hexdigest()


class CachingHashFunction:
    def __init__(self, filename):
        self.filename = filename
        self.cache = {}
        self.dirty = False
        if filename is not None and os.path.exists(filename):
            with open(filename, "rt") as fd:
                self.cache = json.load(fd)

    def hash_featherfile(self, filename):
        return self._check_cache(filename, hash_from_featherfile)

    def _check_cache(self, filename, cache_callback):
        filename = os.path.normpath(filename)
        mtime = os.path.getmtime(filename)
        if filename in self.cache:
            cache_entry = self.cache[filename]
            if (
                "mtime" in cache_entry
                and cache_entry["mtime"] == mtime
                and "sha256" in cache_entry
            ):
                h = cache_entry["sha256"]
        else:
            h = cache_callback(filename)
            cache_entry = dict(sha256=h, mtime=mtime)
            self.cache[filename] = cache_entry
            self.dirty = True
        return h

    def hash_filename(self, filename):
        return self._check_cache(filename, hash_from_file)

    def persist(self):
        if self.dirty and self.filename is not None:
            with open(self.filename, "wt") as fd:
                json.dump(self.cache, fd, indent=1)
            self.dirty = False


parser = argparse.ArgumentParser(description="hash files and parameters together")
parser.add_argument(
    "--cache", help="path to where we can store cached versions of hashes"
)
parser.add_argument(
    "--file",
    "-u",
    action="append",
    help="include the contents of this file in the hash",
    dest="files",
)
parser.add_argument("--output", "-o", help="where to write the hash")
parser.add_argument("--len", type=int, default=20, help="length of hash to write")
parser.add_argument("strings", nargs="*", help="include this value in the hash")

args = parser.parse_args()

hasher = CachingHashFunction(args.cache)

m = hashlib.sha256()
for string in args.strings:
    m.update(string.encode("utf8"))

if args.files is not None:
    for file in args.files:
        # sparkles takes filenames of the form 'src:dest' but for this we need only worry about the src part
        # unless the file is a feather file. (Feather files are non-deterministic so we need to hash the
        # contents instead of relying on the actual file)
        orig_file = file
        if ":" in file:
            src_file, dest_file = file.split(":")
        else:
            src_file = file
            dest_file = file

        if dest_file.endswith(".ftr") and os.path.getsize(src_file) > 0:
            file_type = "feather"
            h = hasher.hash_featherfile(src_file)
        else:
            file_type = "normal"
            h = hasher.hash_filename(src_file)
        print(f"Adding {h} ({orig_file}, {file_type} file)")
        m.update(h.encode("utf8"))

final_hash = m.hexdigest()[: args.len]

if args.output is None:
    print(final_hash)
else:
    with open(args.output, "wt") as fd:
        fd.write(final_hash)
