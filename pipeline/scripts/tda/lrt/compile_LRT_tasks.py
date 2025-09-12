import sys
import os
import pandas as pd

args = sys.argv[1:]
tmp_file_dir = args[0]
out_file = args[1]

in_files = [f for f in os.listdir(tmp_file_dir) if f.endswith(".csv")]
LRT_list = []

for i in range(len(in_files)):
    LRT_list.append(pd.read_csv(os.path.join(tmp_file_dir, in_files[i])))

LRT_result = pd.concat(LRT_list, axis=0, ignore_index=True)
LRT_result.to_csv(out_file, index=False)
