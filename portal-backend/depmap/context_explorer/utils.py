import pandas as pd

from depmap import data_access
from depmap.context.models_new import SubtypeNode
from depmap.context_explorer.models import ContextPathInfo
from depmap.compound.models import (
    CompoundExperiment,
    Compound,
)
from depmap.gene.models import Gene
import re


def get_full_row_of_values_and_depmap_ids(dataset_name: str, label: str) -> pd.Series:
    full_row_of_values = data_access.get_row_of_values(
        dataset_id=dataset_name, feature=label
    )

    if full_row_of_values.empty:
        return pd.Series()

    return full_row_of_values


def get_path_to_node(selected_code: str) -> ContextPathInfo:
    node_obj = SubtypeNode.get_by_code(selected_code)

    cols = [
        node_obj.level_0,
        node_obj.level_1,
        node_obj.level_2,
        node_obj.level_3,
        node_obj.level_4,
        node_obj.level_5,
    ]
    path = [col for col in cols if col != None]

    return ContextPathInfo(path=path, tree_type=str(node_obj.tree_type.value))


def _get_compound_experiment_id_from_entity_label(entity_full_label: str):
    m = re.search(r"([A-Z0-9]*:[A-Z0-9-]*)", entity_full_label)
    compound_experiment_id = m.group(1)

    return compound_experiment_id


def get_compound_experiment(entity_full_label: str):
    compound_experiment_id = _get_compound_experiment_id_from_entity_label(
        entity_full_label=entity_full_label
    )

    assert ":" in compound_experiment_id
    compound_experiment = CompoundExperiment.get_by_xref_full(
        compound_experiment_id, must=False
    )

    return compound_experiment


def get_entity_id_from_entity_full_label(
    entity_type: str, entity_full_label: str
) -> dict:
    entity = None
    if entity_type == "gene":
        m = re.match("\\S+ \\((\\d+)\\)", entity_full_label)

        assert m is not None
        entrez_id = int(m.group(1))
        gene = Gene.get_gene_by_entrez(entrez_id)
        assert gene is not None
        label = gene.label
        entity = gene
        entity_id = entity.entity_id
    else:
        compound_experiment = get_compound_experiment(
            entity_full_label=entity_full_label
        )
        entity_id = compound_experiment.entity_id
        label = Compound.get_by_entity_id(entity_id).label

    return {"entity_id": entity_id, "label": label}
