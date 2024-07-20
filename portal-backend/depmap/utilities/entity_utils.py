from typing import List

from depmap.compound.models import (
    CompoundDose,
    CompoundDoseReplicate,
    CompoundExperiment,
)
from depmap.entity.models import Entity
from depmap.proteomics.models import Protein
from depmap.utilities.exception import InvalidEntityTypeError


def get_entity_class_by_name(entity_class_name: str):
    subclasses = Entity.__subclasses__()
    subclass_by_tablename = {
        subclass.__tablename__: subclass for subclass in subclasses
    }
    if entity_class_name in subclass_by_tablename:
        return subclass_by_tablename[entity_class_name]
    raise InvalidEntityTypeError(f"{entity_class_name} is not a subclass of Entity")


def get_matching_entity_ids_for_label(entity_class, entity_label: str) -> List[int]:
    if entity_class in {
        CompoundDose,
        CompoundDoseReplicate,
        CompoundExperiment,
    }:
        return [
            entity.entity_id
            for entity in entity_class.get_all_for_compound_label(
                entity_label, must=False
            )
        ]
    elif entity_class == Protein:
        # The UI gives the user the option to filter by gene symbol, but
        # protein entity_labels are in the format: SOX10 (P56693).
        # As a result, we need to get the protein entities by gene symbol instead
        # of label.
        entities = entity_class.get_from_gene_symbol(entity_label)

        return [entity.entity_id for entity in entities]
    else:
        entity = entity_class.get_by_label(entity_label, must=False)

    if entity:
        return [entity.entity_id]
    return []
