import numpy as np


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
