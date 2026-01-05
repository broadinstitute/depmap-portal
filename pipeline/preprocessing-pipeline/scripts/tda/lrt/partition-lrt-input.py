import pandas as pd
import numpy as np
from itertools import compress

import argparse

parser = argparse.ArgumentParser()
parser.add_argument("gene_effect")
parser.add_argument("indices")
parser.add_argument("jobs_per_task", type=int)
# parser.add_argument("filelist")
args = parser.parse_args()

# Param info
Y = pd.read_csv(args.gene_effect, index_col=0)
num_genes = Y.shape[1]
assert num_genes > 3000  # make sure matrix is oriented the right way

jobs_per_task = args.jobs_per_task
start_index = np.array(range(0, num_genes, jobs_per_task))
end_index = start_index + jobs_per_task
end_index[-1] = num_genes
param_df = pd.DataFrame({"start": start_index, "end": end_index})
param_df.to_csv(args.indices, index=False)

# File info
# file_df = pd.DataFrame({'file':[args.gene_effect]})
# file_df.to_csv(args.filelist,index=False,header=False)
