from taigapy import create_taiga_client_v3
from utils import update_taiga
from datarelease_taiga_permanames import cngene_log2_taiga_permaname
from config import hgnc_gene_table_taiga_id


def process_and_update_genetic_derangement(source_dataset_id, target_dataset_id):

    """Generate genetic derangement data for predictability and upload it to Taiga."""

    tc = create_taiga_client_v3()

    print("Getting log2 transformed CNGene data...")
    cn_data = tc.get(f"{source_dataset_id}/{cngene_log2_taiga_permaname}")
    cn_stripped = cn_data.copy()
    cn_stripped.columns = [s.split(" ")[0] for s in cn_data.columns]

    hgnc_gene_table = tc.get(f"{hgnc_gene_table_taiga_id}")
    cytoband_data = hgnc_gene_table[["symbol", "location"]]

    print("Generating genetic derangement data...")
    genetic_derangement_matrix = cn_stripped.groupby(
        cytoband_data.set_index("symbol")["location"], axis=1
    ).mean()
    print("Generated genetic derangement data")

    update_taiga(
        genetic_derangement_matrix,
        "Generate genetic derangement data for predictability",
        target_dataset_id,
        "PredictabilityGenticDerangementTransformed",
    )
