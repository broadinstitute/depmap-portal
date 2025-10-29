from typing import Literal
import pandas as pd

from depmap import data_access
from depmap.context.models_new import SubtypeNode, TreeType
from depmap.context_explorer.models import ContextPathInfo
from depmap.compound.models import Compound
from depmap.gene.models import Gene
import re


def get_full_row_of_values_and_depmap_ids(
    dataset_given_id: str, label: str
) -> pd.Series:
    full_row_of_values = data_access.get_row_of_values(
        dataset_id=dataset_given_id, feature=label
    )

    if len(full_row_of_values.cell_lines) == 0:
        return pd.Series()

    return pd.Series(data=full_row_of_values.values, index=full_row_of_values.index)


def get_path_to_node(selected_code: str) -> ContextPathInfo:
    node_obj = SubtypeNode.get_by_code(selected_code)
    assert node_obj is not None

    cols = [
        node_obj.level_0,
        node_obj.level_1,
        node_obj.level_2,
        node_obj.level_3,
        node_obj.level_4,
        node_obj.level_5,
    ]
    path = [col for col in cols if col != None]

    tree_type: Literal["Lineage", "MolecularSubtype"] = TreeType(
        node_obj.tree_type
    ).value
    return ContextPathInfo(path=path, tree_type=tree_type)


# For genes, full label refers to gene_symbol (entrez_id)
def get_feature_id_from_full_label(feature_type: str, feature_full_label: str) -> dict:
    if feature_type == "gene":
        m = re.match("\\S+ \\((\\d+)\\)", feature_full_label)

        gene = None
        if m is not None:
            entrez_id = int(m.group(1))
            gene = Gene.get_gene_by_entrez(entrez_id)
        else:
            gene = Gene.get_by_label(feature_full_label)

        assert gene is not None
        label = gene.label
        entity_overview_page_label = gene.label
        feature_id = gene.entrez_id

    else:
        compound = Compound.get_by_compound_id(feature_full_label)
        label = compound.label
        entity_overview_page_label = compound.label
        feature_id = compound.compound_id  # e.g. DPC-000001

    return {
        "feature_id": feature_id,
        "label": label,
        "entity_overview_page_label": entity_overview_page_label,
    }
