import argparse
import sys
from pandas.core.indexes.base import Index
import re

from taigapy import create_taiga_client_v3

import numpy as np
import pandas as pd

# hack needed for hdf5 utils
sys.path.append(".")
from hdf5_utils import write_hdf5


def reformat_rep1m(data: pd.DataFrame) -> pd.DataFrame:
    # detect whether cell lines are in rows or columns and transpose if necessary. (We want compound as indexes and cell lines as columns)
    if data.index[0].startswith("ACH"):
        df = data.transpose()
    else:
        assert data.columns[0].startswith("ACH")
        df = data
    # Reformat the compound names
    df.index = [
        "BRD:" + re.search("BRD-[^-]+-\\d\\d\\d-\\d\\d-\\d", x).group()
        for x in df.index
    ]
    # Median collapse the replicate compounds
    df = df.groupby(df.index, as_index=True).median()

    return df


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("taiga_id", type=str)
    parser.add_argument("output", type=str)
    args = parser.parse_args()

    tc = create_taiga_client_v3()

    data = tc.get(args.taiga_id)
    df = reformat_rep1m(data)

    # create hdf5
    write_hdf5(df, args.output)
