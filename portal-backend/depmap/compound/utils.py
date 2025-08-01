from depmap import data_access
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
        priority=priority,
        auc_dataset_display_name=auc_dataset_display_name,
        viability_dataset_display_name=viability_dataset_display_name,
    )

    return with_names_and_priority
