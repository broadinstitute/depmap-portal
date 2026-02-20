from depmap import data_access
from depmap.data_access.models import MatrixDataset


def get_default_crispr_dataset() -> MatrixDataset:
    crispr_dataset_given_id = "Chronos_Combined"
    default_crispr_dataset = data_access.get_matrix_dataset(crispr_dataset_given_id)

    return default_crispr_dataset


def get_default_rnai_dataset() -> MatrixDataset:
    rnai_dataset_given_id = "RNAi_merged"
    default_rnai_dataset = data_access.get_matrix_dataset(rnai_dataset_given_id)

    return default_rnai_dataset
