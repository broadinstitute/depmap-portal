import pandas as pd
from taigapy import create_taiga_client_v3

# this script is out of date
compound_names = [
    "Erlotinib",
    "Doxorubicin",
    "Etoposide",
    "Gemcitabine",
    "talopram",
    "Afatinib",
    "BRD-A02303741",
    "zebularine",
]
lower_names = {x.lower() for x in compound_names}

# general compound metadata
# use output of the merge_cpd_data pipeline step
df_merged_metadata = pd.read_csv(
    "~/depmap/pipeline/state/r27/ctd2-sanger-combined-drugs.csv"
)
df_merged_metadata = df_merged_metadata[
    df_merged_metadata["CompoundName"].str.lower().isin(lower_names)
]
df_merged_metadata["GeneSymbolOfTargets"].iloc[
    0
] = "NRAS, MAP4K4"  # set target genes to some genes actually in the dev db

# clear metadata columns for gemcitabine
for col in df_merged_metadata.columns:
    if col not in {"SampleIDs", "CompoundName", "Synonyms"}:
        df_merged_metadata.loc[
            df_merged_metadata["CompoundName"] == "Gemcitabine", col
        ] = df_merged_metadata.loc[
            df_merged_metadata["CompoundName"] == "BRD-A02303741", col
        ]

df_merged_metadata.to_csv("sample_data/compound/compounds.csv", index=False)

# repurposing annotations
tc = create_taiga_client_v3()
df_repurposing = tc.get(id="repurposing-compound-annotations-0431.1")
df_repurposing = df_repurposing.loc[df_repurposing["Name"].isin(lower_names)]

assert len(df_repurposing) == len(lower_names)

df_repurposing.to_csv("repurposing_export_cleaned.csv", index=False)
