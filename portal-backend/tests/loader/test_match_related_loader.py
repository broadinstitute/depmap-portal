import pandas as pd

from depmap.gene.models import Gene
from depmap.match_related.models import RelatedEntityIndex

from loader.match_related_loader import load_match_related


def test_load_match_related(empty_db_with_genes):
    df = pd.read_csv("sample_data/match_related.csv")
    df_copy = df.copy()
    load_match_related(df)

    sox10 = Gene.get_gene_by_entrez(entrez_id=6663)

    related_entity_index = RelatedEntityIndex.get(sox10.entity_id)

    assert related_entity_index is not None

    entries_in_df = df_copy[df_copy["target"] == "SOX10 (6663)"]

    related_entity_ids = related_entity_index.get_related_entity_ids()
    related_genes = [
        Gene.get_by_entity_id(entity_id) for entity_id in related_entity_ids
    ]

    assert all(
        f"{gene.symbol} ({gene.entrez_id})" in entries_in_df["partner"].values
        for gene in related_genes
    )
