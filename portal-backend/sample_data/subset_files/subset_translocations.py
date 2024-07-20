import random
from taigapy import create_taiga_client_v3

tc = create_taiga_client_v3()

df = tc.get(name="translocations-b331", version="4")
assert df is not None

gene_syms = [
    "AMY1A",
    "ANOS1",
    "F8A1",
    "HNF1B",
    "KDM7A",
    "MAP4K4",
    "MED1",
    "MIR3613",
    "NRAS",
    "PSG7",
    "SOX10",
    "SWI5",
    "TNS2",
    "TRIL",
    "UNC93B1",
]
cell_lines = {
    "HS294T_SKIN",
    "A673_BONE",
    "EWS502_BONE",
    "HT29_LARGE_INTESTINE",
    "A2058_SKIN",
    "C32_SKIN",
    "143B_BONE",
    "CADOES1_BONE",
    "CJM_SKIN",
    "COLO679_SKIN",
    "EKVX_LUNG",
    "EPLC272H_LUNG",
    "UACC62_SKIN",
    "SKMEL30_SKIN",
    "WM88_SKIN",
    "PETA_SKIN",
    "TC32_BONE",
    "WM115_SKIN",
    "SH4_SKIN",
}

df = df.loc[df["CCLE_name"].isin(cell_lines)]
# we don't have translocations with our common genes, so we can't just subset. Instead fake the data
row_count = df.shape[0]
df["gene1"] = [random.choice(gene_syms) for i in range(row_count)]
df["gene2"] = [random.choice(gene_syms) for i in range(row_count)]
df = df.head(20)

df.to_csv("translocations.csv", index=False)
