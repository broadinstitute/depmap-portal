from depmap.interactive.config.utils import (
    __get_config,
    is_custom,
)

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
