import numpy as np

from depmap.dataset.models import DependencyDataset
from depmap.gene.models import Gene
from depmap.predictability_prototype.models import PrototypePredictiveModel

DATASET_TAIGA_IDS_BY_MODEL_NAME_CRISPR = {
    "CellContext": "predictability-76d5.107/CellContext_predictions_crispr",
    "DNA": "predictability-76d5.107/DNA_predictions_crispr",
    "DriverEvents": "predictability-76d5.107/DriverEvents_predictions_crispr",
    "RNASeq": "predictability-76d5.107/RNASeq_predictions_crispr",
    "GeneticDerangement": "predictability-76d5.107/GeneticDerangement_predictions_crispr",
}

DATASET_TAIGA_IDS_BY_MODEL_NAME_RNAI = {
    "CellContext": "predictability-76d5.108/CellContext_predictions_rnai",
    "DNA": "predictability-76d5.108/DNA_predictions_rnai",
    "DriverEvents": "predictability-76d5.108/DriverEvents_predictions_rnai",
    "RNASeq": "predictability-76d5.108/RNASeq_predictions_rnai",
    "GeneticDerangement": "predictability-76d5.108/GeneticDerangement_predictions_rnai",
}


def get_value_labels_temp_hack(gene_series, value_labels, values):
    filtered_value_labels = []
    filtered_values = []
    for j, val_lab in enumerate(value_labels):
        if val_lab in gene_series.index.tolist():
            if values[j] is not np.nan and values[j] is not np.inf:
                filtered_value_labels.append(val_lab)
                filtered_values.append(values[j])

    return filtered_values, filtered_value_labels


def translate_to_bb_ids_hack(screen_type: str, model_name: str, entity_label: str):
    # TODO: remove the need for this function
    # ideally we should be able to move to using breadbox IDs at this point, and start including those in these
    # endpoints instead of relying on gene symbols and screen names. The code below are making some assumptions
    # which may not be true in the future
    given_id = str(Gene.get_by_label(entity_label).entrez_id)
    dataset = DependencyDataset.get_dataset_by_data_type_priority(screen_type)

    return str(dataset.name.value), given_id


def get_prediction_dataset_id_hack(
    model_name, screen_type, entity_id, dataset_id_by_taiga_id: dict[str, str]
):
    # find the prediction dataset

    predictive_model = PrototypePredictiveModel.get_by_model_name_and_screen_type_and_entity_id(
        model_name=model_name, screen_type=screen_type, entity_id=entity_id
    )
    return dataset_id_by_taiga_id[predictive_model.predictions_dataset_taiga_id]
