import random
from taigapy import create_taiga_client_v3

tc = create_taiga_client_v3()

df = tc.get("internal-19q2-9504.24/CCLE_fusions")
assert df is not None

gene_syms = [
    "AMY1A (ENSG00000237763)",
    "ANOS1 (ENSG00000011201)",
    "F8A1 (ENSG00000277203)",
    "HNF1B (ENSG00000275410)",
    "KDM7A (ENSG00000006459)",
    "MAP4K4 (ENSG00000071054)",
    "MED1 (ENSG00000125686)",
    "MIR3613 (ENSG00000264864)",
    "NRAS (ENSG00000213281)",
    "PSG7 (ENSG00000221878)",
    "SOX10 (ENSG00000100146)",
    "SWI5 (ENSG00000175854)",
    "TNS2 (ENSG00000111077)",
    "TRIL (ENSG00000255690)",
    "UNC93B1 (ENSG00000110057)",
]

cell_lines = {
    "ACH-000014",
    "ACH-000052",
    "ACH-000279",
    "ACH-000552",
    "ACH-000788",
    "ACH-000580",
    "ACH-001001",
    "ACH-000210",
    "ACH-000458",
    "ACH-000805",
    "ACH-000706",
    "ACH-000585",
    "ACH-000425",
    "ACH-000810",
    "ACH-000899",
    "ACH-001170",
    "ACH-001205",
    "ACH-000304",
    "ACH-000441",
}

df = df.loc[df["ModelID"].isin(cell_lines)]
# df = df.loc[df['Left Gene'].isin(gene_syms) & df['Right Gene'].isin(gene_syms)]
# we don't have fusions with our common genes, so we can't just subset. Instead fake the data
row_count = df.shape[0]
df["LeftGene"] = [random.choice(gene_syms) for i in range(row_count)]
df["RightGene"] = [random.choice(gene_syms) for i in range(row_count)]
df = df.head(20)

# then for test_mutation_translocation_fusion_has_gene, ensure that ANOS1 (ENSG00000011201) is only in left, and F8A1 (ENSG00000277203) is only in right
# otherwise, set manually
assert len(df[df["LeftGene"] == "ANOS1 (ENSG00000011201)"]) > 0
assert len(df[df["RightGene"] == "ANOS1 (ENSG00000011201)"]) == 0

assert len(df[df["LeftGene"] == "F8A1 (ENSG00000277203)"]) == 0
assert len(df[df["RightGene"] == "F8A1 (ENSG00000277203)"]) > 0

# for our sample data, ensure that representative gene and cell line SOX10 and UACC62 ( ACH-000425 ) have fusions
# otherwise, set manually
assert len(df[df["LeftGene"] == "SOX10 (ENSG00000100146)"]) > 0
assert len(df[df["RightGene"] == "SOX10 (ENSG00000100146)"]) > 0
assert len(df[df["ModelID"] == "ACH-000425"]) > 0

df.to_csv("fusions.csv", index=False)
