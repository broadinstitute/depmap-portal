# this script
# 1) Transposes the matrix, so that cell lines are columns and compound+dose are rows
# 2) Collapses (compound, dose) that are duplicated across multiple screens.
#    This collapsing is done by taking the value of the smaller screen.
#    Specifically for these secondary dataset screens, the priority is MTS6 > MTS5 > HTS4
# produces an output file with dropped rows, for logging/debugging

import argparse
import sys
from typing import List, Tuple

import json
import pandas as pd
from taigapy import create_taiga_client_v3

sys.path.append(".")
from hdf5_utils import write_hdf5


def filter_dose_level(data: pd.DataFrame, treatment_info: pd.DataFrame):
    # At this point, all rows with the same Broad ID should be from the same screen, so
    # the only duplicate (broad_id, dose) rows should be for different compound plates.
    # We want to take the mean of those duplicate rows.
    cell_lines = data.columns
    agg_funcs = dict.fromkeys(cell_lines, "mean")
    agg_funcs["column_name"] = "first"

    data = data.merge(
        treatment_info, how="inner", left_index=True, right_on="column_name"
    )
    data = (
        data.groupby(["broad_id", "dose"]).aggregate(agg_funcs).set_index("column_name")
    )
    return data


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("datafile_name", type=str)
    parser.add_argument("treatment_info_file_name", type=str)
    args = parser.parse_args()

    datafile_name = args.datafile_name
    treatment_info_file_name = args.treatment_info_file_name

    data = pd.read_csv(datafile_name, index_col=0)
    data = data.T
    treatment_info = pd.read_csv(treatment_info_file_name)
    data = filter_dose_level(data, treatment_info)
    write_hdf5(data, "out.hdf5")
