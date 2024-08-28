import time
from depmap.data_explorer_2.datasets import get_datasets_matching_context_with_details
from depmap.data_explorer_2.plot import (
    compute_dimension,
    compute_filter,
    compute_metadata,
)
from depmap.data_explorer_2.utils import (
    clear_cache,
    get_datasets_from_dimension_type,
    get_dimension_labels_of_dataset,
    get_union_of_index_labels,
)

TEST_DIMENSION = {
    "dataset_id": "Chronos_Combined",
    "slice_type": "depmap_model",
    "axis_type": "aggregated_slice",
    "context": {
        "context_type": "depmap_model",
        "expr": {
            "and": [
                {
                    ">": [
                        {
                            "var": "slice/ssgsea/HALLMARK_EPITHELIAL_MESENCHYMAL_TRANSITION/label"
                        },
                        0.25,
                    ]
                },
                {"==": [{"var": "slice/growth_pattern/all/label"}, "Adherent"]},
            ]
        },
        "name": "Mesenchymal",
    },
    "aggregation": "mean",
}


def generate_performance_report():
    return {
        "get_union_of_index_labels": _test_get_union_of_index_labels(),
        "compute_dimension": _test_compute_dimension(),
        "compute_filter": _test_compute_filters(),
        "compute_metadata": _test_compute_metadata(),
        "get_dimension_labels_of_dataset": _test_get_dimension_labels_of_dataset(),
        "get_datasets_matching_context": _test_datasets_matching_context(),
    }


def _test_get_union_of_index_labels():
    start = time.time()
    get_union_of_index_labels("gene", ["Chronos_Combined", "expression"])
    elapsed = time.time() - start

    return round(elapsed, 4)


def _test_compute_dimension():
    start = time.time()
    compute_dimension(TEST_DIMENSION, "gene")
    elapsed = time.time() - start

    return round(elapsed, 4)


def _test_compute_filters():
    input_filter = {
        "context_type": "gene",
        "expr": {
            "==": [{"var": "slice/gene_essentiality/all/label"}, "common essential",]
        },
        "name": "common essential",
    }

    start = time.time()
    compute_filter(input_filter)
    elapsed = time.time() - start

    return round(elapsed, 4)


def _test_compute_metadata():
    metadata = {"slice_id": "slice/gene_selectivity/all/label"}

    start = time.time()
    compute_metadata(metadata)
    elapsed = time.time() - start

    return round(elapsed, 4)


def _test_datasets_matching_context():
    context = {
        "name": "VPS4B",
        "context_type": "gene",
        "expr": {"==": [{"var": "entity_label"}, "VPS4B"]},
    }

    start = time.time()
    get_datasets_matching_context_with_details(context)
    elapsed = time.time() - start

    return round(elapsed, 4)


def _test_get_dimension_labels_of_dataset():
    clear_cache()

    return {
        "before caching": _measure_all_dimension_types(get_dimension_labels_of_dataset),
        "from cache": _measure_all_dimension_types(get_dimension_labels_of_dataset),
    }


def _measure_all_dimension_types(func):
    out = {}

    for dimension_type in [
        "depmap_model",
        "gene",
        "compound",
        "msigdb_gene_set",
        "other",
    ]:
        start = time.time()

        for dataset in get_datasets_from_dimension_type(dimension_type):
            func(dimension_type, dataset)

        elapsed = time.time() - start
        out[dimension_type] = round(elapsed, 4)

    out["total"] = round(sum(out.values()), 4)

    return out
