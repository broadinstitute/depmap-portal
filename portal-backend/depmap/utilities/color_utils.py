from depmap import data_access
from depmap.dataset.models import BiomarkerDataset
from depmap.interactive.config.categories import (
    DAMAGING_INDEX,
    HOTSPOT_INDEX,
    OTHER_CONSERVING_INDEX,
    OTHER_NON_CONSERVING_INDEX,
)


def rna_mutations_color_num_to_category(color_num):
    # these are duplicately defined in categories.py, MutationConfig
    if color_num == 0:
        return "Other"
    elif color_num == 1:
        return "Other conserving"
    elif color_num == 2:
        return "Other non-conserving"
    elif color_num == 3:
        return "Damaging"
    elif color_num == 4:
        return "Hotspot"
    else:
        # yes this is horrible, but still need to assign colors first to take the max
        raise ValueError


def get_gene_mutation_colors(label: str):
    mutations = data_access.get_row_of_values(
        BiomarkerDataset.BiomarkerEnum.mutations_prioritized.name, label
    )

    category_num_mapping = {
        "Other": 0,
        "Other non-conserving": OTHER_NON_CONSERVING_INDEX,
        "Other conserving": OTHER_CONSERVING_INDEX,
        "Damaging": DAMAGING_INDEX,
        "Hotspot": HOTSPOT_INDEX,
    }
    mutations = mutations.replace(category_num_mapping)

    return mutations


def get_all_mutation_colors_except_0():
    return [1, 2, 3, 4]
