import pandas as pd
import numpy as np

from taigapy import create_taiga_client_v3
from utils import update_taiga
from datarelease_taiga_permanames import omics_somatic_mutations_taiga_permaname
from config import oncokb_annotated_taiga_id


def reformat_entrez_id(x):
    """Reformat the Entrez ID to a string"""

    if pd.isna(x):
        return ""
    if isinstance(x, float):
        x_int = int(x)
        assert x_int == x
        return str(x_int)
    if x == "Unknown":
        return ""
    else:
        assert x.endswith(".0")  # should really formatted as an int, not a decimal
        x = x[:-2]
    return x


def process_and_update_driver_events(source_dataset_id, target_dataset_id):
    """Transform driver events data for predictability and upload it to Taiga."""

    tc = create_taiga_client_v3()

    print("Getting driver events data...")
    mutations = tc.get(f"{source_dataset_id}/{omics_somatic_mutations_taiga_permaname}")
    oncokb_annotated = tc.get(oncokb_annotated_taiga_id)

    print("Transforming driver events data...")
    mutations["EntrezGeneID"] = mutations["EntrezGeneID"].apply(reformat_entrez_id)
    oncokb_annotated["ProteinChange"] = oncokb_annotated["ProteinChange"].map(
        "p.{}".format
    )
    oncokb_annotated["EntrezGeneID"] = oncokb_annotated["EntrezGeneID"].astype(str)

    # Merge mutations and oncokb_annotated on=["EntrezGeneID", "ProteinChange"]
    merged_annotated_df = mutations.merge(
        oncokb_annotated,
        on=["EntrezGeneID", "ProteinChange"],
        how="left",
        suffixes=("", "_oncokb"),
    )
    assert merged_annotated_df.shape[0] == mutations.shape[0]

    maf_oncogenic = merged_annotated_df.query(
        "Oncogenic in ['Likely Oncogenic', 'Oncogenic']"
    ).copy()
    maf_oncogenic["altDir"] = maf_oncogenic.MutationEffect.replace(
        {
            "Likely Loss-of-function": "LoF",
            "Loss-of-function": "LoF",
            "Unknown": np.nan,
            "Gain-of-function": "GoF",
            "Likely Gain-of-function": "GoF",
            "Switch-of-function": np.nan,
            "Inconclusive": np.nan,
            "Likely Switch-of-function": np.nan,
        }
    )
    maf_oncogenic = maf_oncogenic[maf_oncogenic.altDir.notnull()]
    maf_oncogenic["pivot_col"] = maf_oncogenic.apply(
        lambda x: "%s_%s" % (x.HugoSymbol, x.altDir), axis=1
    )
    maf_oncogenic["pivot_val"] = True
    driver_events_matrix = pd.pivot(
        maf_oncogenic.drop_duplicates(subset=["ModelID", "pivot_col"]),
        index="ModelID",
        columns="pivot_col",
        values="pivot_val",
    ).fillna(False)
    driver_events_matrix.reset_index(inplace=True)
    driver_events_matrix.columns.name = None
    driver_events_matrix.set_index("ModelID", inplace=True)
    driver_events_matrix.index.name = None

    driver_events_matrix = driver_events_matrix.replace({True: 1.0, False: 0.0})

    update_taiga(
        driver_events_matrix,
        "Transform and update driver events data for predictability",
        target_dataset_id,
        "PredictabilityDriverEvents",
    )
