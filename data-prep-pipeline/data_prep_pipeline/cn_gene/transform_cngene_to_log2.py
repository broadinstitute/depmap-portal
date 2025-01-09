import numpy as np
import pandas as pd
from taigapy import create_taiga_client_v3

from ..datarelease_taiga_permanames import (
    cngene_taiga_permaname,
    cngene_log2_taiga_permaname,
)
from ..utils import update_taiga


def transform_cngene_to_log2(df: pd.DataFrame):
    """Transform data to log2 scale."""
    return np.log2(df + 1)


def process_and_update_cngene_log2(source_dataset_id, target_dataset_id):
    """Transform CN gene expression data to log2 scale and upload to Taiga."""

    tc = create_taiga_client_v3()

    print("Getting CN gene expression data...")
    cngene_expression_data = tc.get(f"{source_dataset_id}/{cngene_taiga_permaname}")

    print("Transforming CN gene expression data to log2 scale...")
    log2_transformed_data = transform_cngene_to_log2(cngene_expression_data)
    print("Transformed CN gene expression data to log2 scale")

    update_taiga(
        log2_transformed_data,
        "Transform CN gene expression data to log2 scale",
        target_dataset_id,
        cngene_log2_taiga_permaname,
    )
