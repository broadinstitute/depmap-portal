from taigapy import default_tc as tc
import argparse
from hdf5_utils import write_hdf5

parser = argparse.ArgumentParser()

parser.add_argument("--achilles_lfc_taiga_id", type=str)
parser.add_argument("--achilles_replicate_map_taiga_id", type=str)

achilles_lfc_taiga_id = parser.parse_args().achilles_lfc_taiga_id
achilles_replicate_map_taiga_id = parser.parse_args().achilles_replicate_map_taiga_id


achilles_lfc = tc.get(achilles_lfc_taiga_id)
achilles_replicate_map = tc.get(achilles_replicate_map_taiga_id).set_index("SequenceID")
achilles_lfc_cell = achilles_lfc.groupby(
    achilles_replicate_map.ModelID, axis=1
).median()

write_hdf5(achilles_lfc_cell, "achilles_lfc_per_cell_line.hdf5")
