from depmap.entity.models import Entity
from depmap.dataset.models import Dataset
from depmap.interactive.config.utils import (
    __get_config,
    is_continuous,
    is_categorical,
    is_custom,
    is_standard,
    get_entity_type,
)


def get_nonstandard_categorical_datasets():
    return {
        k
        for k in __get_config().all_datasets
        if is_categorical(k) and not is_standard(k)
    }


def get_noncustom_continuous_datasets_not_gene_or_compound():
    exclude_entity_types = Entity.get_gene_compound_related_entity_types()
    return {
        k
        for k in __get_config().all_datasets
        if not is_custom(k)
        and is_continuous(k)
        and get_entity_type(k) not in exclude_entity_types
    }


def get_all_dataset_ids():
    """
    This is used for
        - populating custom associations
        - custom downloads
        - de2
    """

    # We do not want to show datasets for RNAi_Ach and RNAi_Nov_DEM in custom downloads and DE2. However, we cannot completely remove them from the codebase now since these dataset are referenced in the downloads overview graph so filter them out instead
    all_dataset_ids = {
        dataset_id
        for dataset_id in __get_config().all_datasets
        if dataset_id
        not in [
            "RNAi_Ach",
            "RNAi_Nov_DEM",
            # Added legacy replicate datasets to this list, because we want to hide them everywhere except for the dose response tabs
            "CTRP_dose_replicate",
            "GDSC1_dose_replicate",
            "GDSC2_dose_replicate",
            "Repurposing_secondary_dose_replicate",
        ]
    }
    # Technically, .all_datasets does not contain custom ones. But just make sure
    assert not any(is_custom(dataset_id) for dataset_id in all_dataset_ids)
    return all_dataset_ids
