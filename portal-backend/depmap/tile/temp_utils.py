# TEMP: Right now, the heatmap tile and tab is only available for OncRef, and drc_compound_datasets only
# has one element in it, so before showing these features we need to check if the compound is in the Breadbox
# version of the OncRef dataset.
def compound_is_in_oncref_dataset(compound, drc_compound_datasets, data_access):
    """
    Returns True if the compound is in the Breadbox version of the OncRef dataset.
    """

    # If this assertion fails, we need to update the places compound_is_in_oncref_dataset is used to support more than
    # one potential dataset.
    assert len(drc_compound_datasets) == 1

    dataset_feature_labels = data_access.get_dataset_feature_labels(
        drc_compound_datasets[0].auc_dataset_given_id
    )
    return compound.label in dataset_feature_labels
