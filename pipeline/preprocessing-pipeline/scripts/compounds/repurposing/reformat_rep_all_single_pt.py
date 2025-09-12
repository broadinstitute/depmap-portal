import argparse
import sys

from taigapy import create_taiga_client_v3
import pandas as pd

# hack needed for hdf5 utils
sys.path.append(".")
from hdf5_utils import write_hdf5


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("taiga_id", type=str)
    args = parser.parse_args()

    tc = create_taiga_client_v3()

    df = tc.get(args.taiga_id)

    # create hdf5
    write_hdf5(df, "rep_all_single_pt_score.hdf5")
