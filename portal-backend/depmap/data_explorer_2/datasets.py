from depmap_compute.context import ContextEvaluator
from depmap.data_explorer_2.utils import (
    get_datasets_from_dimension_type,
    get_dimension_labels_of_dataset,
    slice_to_dict,
)


# TODO: Remove this helper. It's only used for one specific feature type which
# is compound_experiment.
def get_datasets_matching_context_with_details(context) -> list[dict]:
    """
    Returns a list of dictionaries like:
    [
      {
        "dataset_id"    : "Chronos_Combined"
        "dataset_label" : "CRISPR (DepMap Internal 23Q4+Score, Chronos)"
        "dimension_labels" : ["SOX10"]
      },
      ...
    ]
    """
    out = []
    context_type = context["context_type"]
    context_evaluator = ContextEvaluator(context, slice_to_dict)

    for dataset in get_datasets_from_dimension_type(context_type):
        dimension_labels = []

        for label in get_dimension_labels_of_dataset(context_type, dataset):
            if context_evaluator.is_match(label):
                dimension_labels.append(label)

        if len(dimension_labels) > 0:
            out.append(
                {
                    "dataset_id": dataset.id,
                    "dataset_label": dataset.label,
                    "dimension_labels": dimension_labels,
                }
            )

    return out
