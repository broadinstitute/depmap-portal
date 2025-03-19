import collections
import pandas as pd
import sys
import h5py
import pandas as pd
import argparse
from pipeline.scripts.hdf5_utils import write_hdf5


def main(subtype_context_taiga_id, out_hdf5, out_csv):
    from taigapy import create_taiga_client_v3

    tc = create_taiga_client_v3()
    one_hot_encoded_context_matrix = tc.get(subtype_context_taiga_id)
    bool_matrix = one_hot_encoded_context_matrix.astype(bool)
    bool_matrix.set_index("cell_line", inplace=True)
    write_hdf5(bool_matrix.transpose(), out_hdf5)
    bool_matrix.to_csv(out_csv)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("subtype_context_taiga_id")
    parser.add_argument("out_hdf5")
    parser.add_argument("out_csv")
    args = parser.parse_args()
    main(args.subtype_context_taiga_id, args.out_hdf5, args.out_csv)
