import os
from typing import Dict

from flask import current_app
import pandas as pd

from depmap.database import db
from depmap.gene.models import Gene
from depmap.match_related.models import RelatedEntityIndex
from depmap.match_related.utils import MATCH_RELATED_FILE
import re

ENTREZ_ID_PATTERN = re.compile("\\S+ \\((\\d+)\\)")


def load_match_related(df: pd.DataFrame):
    # Save subset of df to file
    # Replace labels in target and partner columns with entity_id (for now only genes)
    all_genes_by_entrez_id: Dict[int, int] = {
        gene.entrez_id: gene.entity_id for gene in Gene.get_all()
    }

    def get_gene_id(label):
        m = ENTREZ_ID_PATTERN.match(label)
        if m is None:
            return None
        return all_genes_by_entrez_id.get(int(m.group(1)))

    df["target"] = df["target"].map(get_gene_id).astype("Int32")
    df["partner"] = df["partner"].map(get_gene_id).astype("Int32")

    # Drop any columns where target or partner are NA, i.e. not entities loaded into the db
    # We could change this to just keep the label for partner
    df = df.dropna(axis="index", how="any")
    df = df.sort_values("target")

    related_entity_index_list = []
    for target, group in df.groupby("target"):
        rei = RelatedEntityIndex(entity_id=int(target))
        rei.set_related_entity_ids({int(x) for x in group["partner"]})
        related_entity_index_list.append(rei)

    db.session.bulk_save_objects(related_entity_index_list)
