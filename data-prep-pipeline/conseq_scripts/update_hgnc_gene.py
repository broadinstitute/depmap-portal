import pandas as pd
from taigapy import create_taiga_client_v3

from config import hgnc_gene_table_taiga_id
from utils import update_taiga


def process_and_update_hgnc_gene(source_dataset_id, target_dataset_id):
    tc = create_taiga_client_v3()

    print("Getting HGNC gene data...")
    hgnc_gene = tc.get(hgnc_gene_table_taiga_id)

    print("Updating HGNC gene data...")
    update_taiga(
        hgnc_gene, "Update HGNC gene data", target_dataset_id, "Gene", "csv_table",
    )
