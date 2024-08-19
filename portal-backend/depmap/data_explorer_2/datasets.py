from depmap.data_explorer_2.context import ContextEvaluator
from depmap.data_explorer_2.utils import (
    get_datasets_from_slice_type,
    get_slice_labels_of_dataset,
)


def get_datasets_matching_context_with_details(context) -> list[dict]:
    """
    Returns a list of dictionaries like:
    [
      {
        "dataset_id"    : "Chronos_Combined"
        "dataset_label" : "CRISPR (DepMap Internal 23Q4+Score, Chronos)"
        "slice_labels" : ["SOX10"]
      },
      ...
    ]
    """
    out = []
    context_type = context["context_type"]
    context_evaluator = ContextEvaluator(context)

    for dataset in get_datasets_from_slice_type(context_type):
        slice_labels = []

        for label in get_slice_labels_of_dataset(context_type, dataset):
            if context_evaluator.is_match(label):
                slice_labels.append(label)

        if len(slice_labels) > 0:
            out.append(
                {
                    "dataset_id": dataset.id,
                    "dataset_label": dataset.label,
                    "slice_labels": slice_labels,
                }
            )

    return out
