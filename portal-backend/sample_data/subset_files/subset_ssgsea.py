from subsets import cell_lines_arxspan
from taigapy import create_taiga_client_v3
import sys

sys.path.append("../../pipeline/scripts")
import hdf5_utils

tc = create_taiga_client_v3()
full = tc.get("internal-21q1-4fc4.36/CCLE_ssGSEA")
col_subset = full.columns[:10]
subset = full.loc[sorted(set(cell_lines_arxspan).intersection(full.index)), col_subset]
hdf5_utils.write_hdf5(subset, "../dataset/ssgsea.hdf5")
