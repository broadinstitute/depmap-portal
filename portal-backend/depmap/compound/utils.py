from depmap import data_access
from depmap.compound import new_dose_curves_utils
from depmap.compound.models import (
    DRCCompoundDataset,
    DRCCompoundDatasetWithNamesAndPriority,
)


def get_compound_dataset_with_name_and_priority(drc_dataset: DRCCompoundDataset):
    auc_dataset_display_name = data_access.get_dataset_label(
        drc_dataset.auc_dataset_given_id
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
