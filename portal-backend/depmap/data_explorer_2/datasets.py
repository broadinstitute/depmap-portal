from depmap.data_explorer_2.context import ContextEvaluator
from depmap.data_explorer_2.utils import (
    get_datasets_from_entity_type,
    get_entity_labels_across_datasets,
    get_entity_labels_of_dataset,
)


def get_datasets_matching_context(context):
    """
    Returns a list of strings that represent dataset IDs
    """
    context_type = context["context_type"]
    context_evaluator = ContextEvaluator(context)
    matching_labels = set()
    dataset_ids = []

    for label in get_entity_labels_across_datasets(context_type):
        if context_evaluator.is_match(label):
            matching_labels.add(label)

    for dataset in get_datasets_from_entity_type(context_type):
        dataset_labels = get_entity_labels_of_dataset(context_type, dataset)
        if not matching_labels.isdisjoint(dataset_labels):
            dataset_ids.append(dataset.id)

    return dataset_ids


def get_datasets_matching_context_with_details(context):
    """
    Returns a list of dictionaries like:
    [
      {
        "dataset_id"    : "Chronos_Combined"
        "dataset_label" : "CRISPR (DepMap Internal 23Q4+Score, Chronos)"
        "entity_labels" : ["SOX10"]
      },
      ...
    ]
    """
    out = []
    context_type = context["context_type"]
    context_evaluator = ContextEvaluator(context)

    for dataset in get_datasets_from_entity_type(context_type):
        entity_labels = []

        for label in get_entity_labels_of_dataset(context_type, dataset):
            if context_evaluator.is_match(label):
                entity_labels.append(label)

        if len(entity_labels) > 0:
            out.append(
                {
                    "dataset_id": dataset.id,
                    "dataset_label": dataset.label,
                    "entity_labels": entity_labels,
                }
            )

    return out
