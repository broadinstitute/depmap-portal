from taigapy import create_taiga_client_v3

tc = create_taiga_client_v3()

df = tc.get(id="hgnc-database-1a29.1")
genes = {
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
}

df = df.loc[df["entrez_id"].isin(genes)]

assert len(df) == len(genes)

df.to_csv("hgnc-database-1a29.1.csv", index=False)
