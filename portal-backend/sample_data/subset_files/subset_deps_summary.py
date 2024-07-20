import pandas as pd

genes_entrez_ids = [
    "375757",
    "9865",
    "23371",
    "81622",
    "5676",
    "80853",
    "8263",
    "100500908",
    "3730",
    "6928",
    "6663",
    "276",
    "4893",
    "9448",
    "5469",
]

df = pd.read_csv(
    "../../pipeline/state/r220/deps.csv",
    converters={"is_strongly_selective": str, "is_common_essential": str},
)
df1 = df[df["gene_id"].isin(genes_entrez_ids)]
df1.to_csv("../dep_summary.csv", index=False)
