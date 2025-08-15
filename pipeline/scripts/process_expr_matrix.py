import sys
import numpy as np
import re

from taigapy import create_taiga_client_v3

from hdf5_utils import write_hdf5
from omics_preprocessing_utils import preprocess_omics_dataframe

root_dir = sys.argv[1]
dataset_id = sys.argv[2]
output_filename = sys.argv[3]

tc = create_taiga_client_v3()
mat = tc.get(dataset_id)
mat = preprocess_omics_dataframe(mat, dataset_id)

if "ModelID" in mat.columns:
    mat = mat.set_index("ModelID")
    mat.index.name = None

# convert mat to log2
mat = np.log2(mat+1)
maxval = np.nanmax(mat.values)  # Find the maximum value in the matrix, ignoring NaNs
print(f"Maxval: {maxval}")

# If the max value is too large, raise an error
# This serves as a check to ensure the data has been log transformed
if maxval > 10000:
    raise ValueError(
        f"The max value was {maxval} which seems large. Verify that the matrix has been log transformed"
    )

# Drop bad gene names. Suspected duplication due to ensembl -> entrez id mapping. Need to fix upstream
bad_columns = ["PINX1 (54984).1", "TBCE (6905).1"]
columns_to_drop = [col for col in bad_columns if col in mat.columns]
mat = mat.drop(columns=columns_to_drop)


def check_bad_names(names):
    bad_names = [name for name in names if re.match(".+\\.\\d+$", name)]
    if len(bad_names) > 0:
        raise ValueError(f"Bad Names: {bad_names}")


check_bad_names(mat.columns)
check_bad_names(mat.index)
print(np.sum(mat.isna().values))  # Print the total count of NaN values in the matrix

print("Transposing")
mat = mat.transpose()

# Sanity check we've got approximately the right number of genes left
if not (15000 < len(mat) < 31000):
    raise ValueError("The number of genes is not within the expected range")

write_hdf5(mat, output_filename)
