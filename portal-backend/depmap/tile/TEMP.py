from depmap.dataset.models import Dataset


def temp_get_legacy_dataset_from_breadbox_dataset_id(dataset_id: str):
    if dataset_id == "Chronos_Combined" or dataset_id == "RNAi_merged":
        return Dataset.get_dataset_by_name(dataset_id)

    if dataset_id == "PRISMOncologyReferenceLog2AUCMatrix":
        return Dataset.get_dataset_by_name("Prism_oncology_AUC")

    if dataset_id == "PRISMOncologyReferenceSeqLog2AUCMatrix":
        return Dataset.get_dataset_by_name("Prism_oncology_AUC_seq")

    if dataset_id == "Rep_all_single_pt_per_compound":
        return Dataset.get_dataset_by_name("Rep_all_single_pt")
