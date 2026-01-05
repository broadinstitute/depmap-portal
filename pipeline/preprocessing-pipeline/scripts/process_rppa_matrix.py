import sys
from taigapy import create_taiga_client_v3
import numpy as np
from hdf5_utils import write_hdf5

root_dir = sys.argv[1]
matrix_taiga_id = sys.argv[2]
mapping_taiga_id = sys.argv[3]
output_filename = sys.argv[4]

tc = create_taiga_client_v3()
mapping = tc.get(mapping_taiga_id)

# Check that the Antibody_Name column is valid and this is the mapping table
assert (
    "Akt_pS473" in mapping["Antibody_Name"].values
), "Antibody_Name 'Akt_pS473' not found in the mapping table."

# Split the Target_Genes column by space
mapping = mapping.assign(Target_Genes=mapping["Target_Genes"].str.split(" ")).explode(
    "Target_Genes"
)

# Add 'rename' column
mapping["rename"] = mapping["Target_Genes"] + " (" + mapping["Antibody_Name"] + ")"

data = tc.get(matrix_taiga_id)
assert data.shape[1] < 300

df = data.T

# Merge the data and mapping DataFrames
merged = df.reset_index().merge(
    mapping[["rename", "Antibody_Name"]],
    left_on="index",
    right_on="Antibody_Name",
    how="right",
)
merged.index = merged["rename"]
merged = merged.drop(columns=["rename", "index", "Antibody_Name"])

# Transpose the merged DataFrame back
renamed_data = merged.T

# Sanity checks
assert (
    renamed_data.shape[0] == data.shape[0]
), "The number of cell lines does not match."
assert renamed_data.shape[1] == len(
    mapping
), "The number of rows does not match the manipulated mapping."
assert (
    renamed_data.loc[:, "AKT1 (Akt_pS473)"] == renamed_data.loc[:, "AKT2 (Akt_pS473)"]
).all(), "The row was not duplicated correctly."

write_hdf5(renamed_data.T, output_filename)
