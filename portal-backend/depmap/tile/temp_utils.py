# TEMP: Right now, the heatmap tile and tab is only available for OncRef, and drc_compound_datasets only
# has one element in it, so before showing these features we need to check if the compound is in the Breadbox
# version of the OncRef dataset.
from depmap import data_access


def compound_is_in_oncref_dataset(compound, drc_compound_datasets):
    """
    Returns True if the compound is in the Breadbox version of the OncRef dataset.
    """

    # If this assertion fails, we need to update the places compound_is_in_oncref_dataset is used to support more than
    # one potential dataset.
    assert len(drc_compound_datasets) == 1

    # Tests break without this try/accept, because auc_dataset_given_id is a breadbox only id
    try:
        return data_access.valid_row(
            drc_compound_datasets[0].auc_dataset_given_id, compound.label
        )
    except Exception:
        return False
