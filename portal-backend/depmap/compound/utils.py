from typing import List, Optional
from depmap import data_access
from depmap.compound import new_dose_curves_utils
from depmap.compound.models import (
    DRCCompoundDataset,
    DRCCompoundDatasetWithNamesAndPriority,
)


def get_compound_dataset_with_name_and_priority(
    drc_dataset: DRCCompoundDataset, use_logged_auc: bool = False
):
    auc_dataset_display_name = data_access.get_dataset_label(
        drc_dataset.auc_dataset_given_id
        if not use_logged_auc
        else drc_dataset.log_auc_dataset_given_id
    )
    priority = data_access.get_dataset_priority(drc_dataset.auc_dataset_given_id)
    viability_dataset_display_name = data_access.get_dataset_label(
        drc_dataset.viability_dataset_given_id
    )

    with_names_and_priority = DRCCompoundDatasetWithNamesAndPriority(
        drc_dataset_label=drc_dataset.drc_dataset_label,
        viability_dataset_given_id=drc_dataset.viability_dataset_given_id,
        replicate_dataset=drc_dataset.replicate_dataset,
        auc_dataset_given_id=drc_dataset.auc_dataset_given_id,
        display_name=drc_dataset.display_name,
        auc_dataset_priority=priority,
        auc_dataset_display_name=auc_dataset_display_name,
        viability_dataset_display_name=viability_dataset_display_name,
        log_auc_dataset_given_id=drc_dataset.log_auc_dataset_given_id,
    )

    return with_names_and_priority


def dataset_exists_with_compound_in_auc_and_rep_datasets(
    drc_dataset: DRCCompoundDataset, compound_label: str, compound_id: str
) -> bool:
    """ 
    We only want to load the dose curves and heatmap if the auc and replicate datasets all exist with the compound.
    The Heatmap relies on dose curve data to load the curve params (hidden columns by default) into the table.
    """
    does_auc_dataset_exist_with_compound = data_access.dataset_exists(
        drc_dataset.auc_dataset_given_id
    ) and data_access.valid_row(drc_dataset.auc_dataset_given_id, compound_label)

    if not does_auc_dataset_exist_with_compound:
        return False

    # See if we can find any dose replicates for this compound. We cannot simply check is valid_row because the feature labels
    # of the replicate set are not equal to the compound_label. If the compound does not exist in this replicate dataset,
    # get_compound_dose_replicates will return an empty list.
    valid_compound_dose_replicates = new_dose_curves_utils.get_compound_dose_replicates(
        compound_id=compound_id,
        drc_dataset_label=drc_dataset.drc_dataset_label,
        replicate_dataset_name=drc_dataset.replicate_dataset,
    )
    does_replicate_dataset_exist_with_compound = (
        data_access.dataset_exists(drc_dataset.replicate_dataset)
        and len(valid_compound_dose_replicates) > 0
    )

    return does_replicate_dataset_exist_with_compound


def find_compound_dataset(
    datasets: List[DRCCompoundDataset], key_name: str, value_name: str
) -> Optional[DRCCompoundDataset]:
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
