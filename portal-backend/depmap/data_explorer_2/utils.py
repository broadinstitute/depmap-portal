import functools
from logging import getLogger

from depmap import data_access


log = getLogger(__name__)


@functools.cache
def get_vector_labels(dataset_id: str, is_transpose: bool) -> list[str]:
    """
    DEPRECATED: this does not use the definition of "labels" that we are using
    going forward. For samples, this returns IDs as labels. 
    Load all labels for an axis of the given dataset.
    If is_transpose, then get depmap_ids/sample labels.
    Otherwise, get sample/feature labels.
    """
    if dataset_id == "Context_Matrix":
        dataset_id = "subtype_matrix"

    if is_transpose:
        return data_access.get_dataset_sample_ids(dataset_id)

    return data_access.get_dataset_feature_labels(dataset_id)


def clear_cache():
    get_vector_labels.cache_clear()
