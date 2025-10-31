from typing import List, Literal, Optional
import pandas as pd

from depmap import data_access
from depmap.context.models_new import SubtypeNode, TreeType
from depmap.context_explorer.models import ContextPathInfo
from depmap.compound.models import Compound, DRCCompoundDataset
from depmap.gene.models import Gene
import re


def get_full_row_of_values_and_depmap_ids(
    dataset_given_id: str, feature_id: str
) -> pd.Series:
    full_row_of_values = data_access.get_row_of_values(
        dataset_id=dataset_given_id, feature=feature_id, feature_identifier="id"
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
def get_feature_id_from_full_label(feature_type: str, feature_id: str) -> dict:
    if feature_type == "gene":
        gene = Gene.get_gene_by_entrez(feature_id)

        assert gene is not None
        label = gene.label
        entity_overview_page_label = gene.label
        feature_id = gene.entrez_id

    else:
        compound = Compound.get_by_compound_id(feature_id)
        label = compound.label
        entity_overview_page_label = compound.label
        feature_id = compound.compound_id  # e.g. DPC-000001

    return {
        "feature_id": feature_id,
        "label": label,
        "entity_overview_page_label": entity_overview_page_label,
    }


def find_compound_dataset(
    datasets: List[DRCCompoundDataset], key_name: str, value_name: str
) -> DRCCompoundDataset:
    """
    Searches a list of DRCCompoundDataset objects for the first object 
    whose attribute (key_name) matches the specified value (value_name).

    Args:
        datasets (List[DRCCompoundDataset]): The list of dataset objects to search.
        key_name (str): The attribute name (e.g., 'auc_dataset_given_id') to check.
        value_name (str): The value to match against the attribute.

    Returns:
        DRCCompoundDataset: The matching dataset object. We expect to always find a match.
    """
    for dataset in datasets:
        attribute_value = getattr(
            dataset, key_name
        )  # Will error if key_name is invalid. This should never happen

        # Check if the attribute was found and if its value matches the target value
        if attribute_value == value_name:
            return dataset

    # If the loop completes without a match
    return None
