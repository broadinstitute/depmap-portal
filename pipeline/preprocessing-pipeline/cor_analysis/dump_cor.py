import packed_cor_tables

import sys

df = packed_cor_tables.read_full(sys.argv[1])
df.to_csv(sys.argv[2])
