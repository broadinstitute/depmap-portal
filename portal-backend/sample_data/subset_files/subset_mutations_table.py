from taigapy import create_taiga_client_v3
import pandas as pd
from subsets import genes_entrez_ids, cell_lines_arxspan

c = TaigaClient()
import numpy.random

# pr_to_model_id = {rec["ProfileID"]: rec["ModelID"] for rec in c.get("internal-23q2-1e49.100/OmicsDefaultModelProfiles").to_records()}

df = c.get("mutations-latest-ed72.37/somaticMutations_profile")
assert len(df) > 0
# df = df.loc[df["DepMap_ID"].isin(pr_to_model_id)]
# assert len(df) > 0
# df["ModelID"] = [ pr_to_model_id[x] for x in df["DepMap_ID"]]
# assert len(df) > 0
# df = df.loc[df["ModelID"].isin(cell_lines_arxspan)]
df["ModelID"] = numpy.random.choice(cell_lines_arxspan, size=len(df))
assert len(df) > 0
df = df.loc[df["EntrezGeneID"].isin([int(x) for x in genes_entrez_ids])]
assert len(df) > 0

df["Oncogenic"] = "Oncogenic"
df["MutationEffect"] = "Gain-of-function"

df.to_csv("../dataset/mutations.csv", index=False)
