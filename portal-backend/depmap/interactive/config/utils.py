from collections import defaultdict
from typing import DefaultDict, Dict, Optional, Set

from flask import current_app

from depmap.enums import DataTypeEnum
from depmap.dataset.models import Dataset
from depmap.download.utils import get_download_url
from depmap.interactive.config import categories
from depmap.interactive.config.models import (
    DatasetSortFirstKey,
    DatasetSortKey,
    InteractiveConfig,
)
from depmap.predictability.utilities import (
    get_predictability_input_files_downloads_link,
)
from depmap.taiga_id import utils as taiga_utils
from depmap.utilities import entity_utils
from depmap.utilities.exception import InteractiveDatasetNotFound
from depmap.utilities.data_access_log import log_legacy_private_dataset_access


def __get_config() -> InteractiveConfig:
    """
    Nothing outside the interactive module and the interactive tests should directly access the config.
    Instead, external things should go through methods in interactive_utils
    Double underscore so that this is not imported in the __init__ of interactive_utils
    This should be available to functions in this module, and things such as tests that deliberately import depmap.interactive.config.utils
    It should not be directly exposed via interactive_utils
    """
    interactive_config = getattr(current_app, "_depmap_interactive_config", None)
    if interactive_config is None:
        interactive_config = (
            current_app._depmap_interactive_config
        ) = InteractiveConfig()
    return interactive_config


def get_context_dataset():
    return __get_config().context_dataset


def get_lineage_dataset():
    return __get_config().lineage_dataset


def get_primary_disease_dataset():
    return __get_config().primary_disease_dataset


def get_disease_subtype_dataset():
    return __get_config().disease_subtype_dataset


def get_tumor_type_dataset():
    return __get_config().tumor_type_dataset


def get_gender_dataset():
    return __get_config().gender_dataset


def get_growth_pattern_dataset():
    return __get_config().growth_pattern_dataset


def get_custom_cell_lines_dataset():
    return __get_config().custom_cell_lines_dataset


# functions to data in config
def get_dataset_label(dataset_id) -> str:
    """
    Returns label of dataset
    """
    if __get_config().is_legacy_private_dataset(dataset_id):
        log_legacy_private_dataset_access("get_dataset_label", dataset_id)
    return __get_config().get(dataset_id).label


def get_dataset_units(dataset_id):
    """
    Returns axis label of dataset (units)
    """
    return __get_config().get(dataset_id).units


def get_dataset_data_type(dataset_id):
    """
    Returns the data type of a dataset
    """
    data_type = __get_config().get(dataset_id).data_type

    # FIXME: This is usually a member of the DataTypeEnum
    # but in the case of "user_upload" it's just a string
    if isinstance(data_type, str):
        data_type = DataTypeEnum[data_type]

    return data_type.value if data_type else None


def get_dataset_priority(dataset_id):
    """
    Returns the priority number of the dataset
    """
    return __get_config().get(dataset_id).priority


def get_feature_name(dataset_id):
    """
    Returns feature name of dataset
    """
    return __get_config().get(dataset_id).feature_name


def get_feature_example(dataset_id):
    """
    Returns feature example of dataset
    """
    return __get_config().get(dataset_id).feature_example


def get_taiga_id(dataset_id):
    """
    Returns canonical taiga id of a dataset
    """
    dataset_config = __get_config().get(dataset_id)
    return dataset_config["taiga_id"]


def get_original_taiga_id(dataset_id):
    """
    This should only be used for generating urls directly to taiga
        i.e., the final outgoing leg of displaying to users
        Should not even be used for indexing into downloads, or the database. use normal taiga id for that
    Returns original taiga id of a dataset
        Original meaning that it might be virtual (as configured), instead of canoical (as used in the db)
    """
    dataset_config = __get_config().get(dataset_id)
    return dataset_config["original_taiga_id"]


def get_matrix_id(dataset_id):
    """
    Returns matrix id of a dataset
    """
    return __get_config().get(dataset_id).matrix_id


def get_entity_type(dataset_id):
    """
    Returns entity type of a dataset
    """
    if dataset_id in categories.gene_datasets_with_entrez_labels:
        # Weird workaround needed to support private datasets with entities in DE2
        # (temporary until these datasets are moved to breadbox)
        return "gene"

    dataset_config = __get_config().get(dataset_id)
    return dataset_config["entity_type"]


def legacy_get_entity_class_name(dataset_id):
    """
    Returns entity type of a dataset
    """
    dataset_config = __get_config().get(dataset_id)
    return dataset_config["entity_class_name"]


def get_entity_class(dataset_id):
    entity_class_name = legacy_get_entity_class_name(dataset_id)
    if entity_class_name is None:
        return None
    else:
        return entity_utils.get_entity_class_by_name(entity_class_name)


def get_dataset_url(dataset_id: str) -> Optional[str]:
    """Get the relative URL for the dataset's download entry, if it exists

    Args:
        dataset_id (str): The `dataset_name` field on Datasets (Dependency and
        Biomarker), or id for other datasets (Nonstandard, Private)
    """

    taiga_id = get_taiga_id(dataset_id)
    # taiga id, not original, needs to be used for getting download url
    download_url = get_download_url(taiga_id)

    dataset = Dataset.get_dataset_by_name(dataset_id, must=False)

    if download_url is not None:
        # end up here as long as there is a download entry. links to the download entry
        return download_url
    elif taiga_id is not None and taiga_id.startswith("derived-data:"):
        return None  # Derived datasets don't necessarily have download links/files
    elif dataset is not None and dataset.is_predictability_feature:
        return get_predictability_input_files_downloads_link()
    elif (
        dataset_id == "context"
        or dataset_id == "lineage"
        or dataset_id == __get_config().custom_cell_lines_dataset
    ):
        # temporary stopgap for that categorical (color) having taiga_id none
        return None
    elif taiga_id is not None and "prism-pools-4441" in taiga_id:
        # The prism-pools dataset was added in advance of the ADC screens in PRISM per Mustafa's request.
        # the pools are needed to visualize potential confounders, but this is intended as a short term solution
        # as we are migrating non-standard datasets to Breadbox. Regardless, we don't have a download to offer for
        # this dataset.
        return None
    elif (
        taiga_id is not None
        and current_app.config["ALLOW_CUSTOM_DOWNLOAD_WITH_TAIGA_URL"]
    ):
        # for custom taiga datasets (don't have downloads), and nonstandard datasetes that may not have downloads.
        # SHOW_TAIGA_IN_DOWNLOADS only, just in case other things other things we don't think about fall into here
        # uses original taiga id, because we are linking directly to taiga. this should be the only use of calling interactive's get_original_taiga_id
        return taiga_utils.get_taiga_url(get_original_taiga_id(dataset_id))
    elif is_custom(dataset_id) or is_private(dataset_id):
        # for custom csv datasets or private datasets, these are the only datasets allowed to not have a download entry
        return None
    else:
        # nonstandard datasets that are public may fall in and get caught here
        raise ValueError(
            "Unexpected dataset " + dataset_id + " without a download entry"
        )


def has_config(dataset_id):
    try:
        __get_config().get(dataset_id)
        return True
    except InteractiveDatasetNotFound:
        return False


def is_standard(dataset_id):
    return __get_config().get(dataset_id).is_standard


def is_transpose(dataset_id):
    """
    Checks whether data was uploaded with cell lines as the columns instead of rows.
    We've been trying to get rid of this for some time, but still have some transposed datasets remaining.
    """
    return __get_config().get(dataset_id).transpose


def is_prepopulate(dataset_id):
    """
    Returns whether prepopulate is True for a given dataset
    Wraps checking for the presence of the prepopulate key and that the value is True
    """
    return __get_config().get(dataset_id)["prepopulate"]


def is_continuous(dataset_id):
    return has_config(dataset_id) and __get_config().get(dataset_id).is_continuous


def is_filter(dataset_id):
    filter_datasets = {
        get_context_dataset(),
        get_custom_cell_lines_dataset(),
    }
    return dataset_id in filter_datasets


def is_custom(dataset_id):
    config = __get_config()
    return has_config(dataset_id) and config.get(dataset_id).is_custom


def is_private(dataset_id):
    config = __get_config()
    return has_config(dataset_id) and config.get(dataset_id).is_private


def is_categorical(dataset_id):
    return has_config(dataset_id) and __get_config().get(dataset_id).is_categorical


def has_opaque_features(dataset_id):
    return __get_config().get(dataset_id).has_opaque_features


def get_private_datasets():
    return __get_config().get_allowed_private_datasets()


def get_all_original_taiga_ids():
    """
    Warning: This is getting the /original/ taiga ids. The web app should use the .taiga_id property, which gets canonical

    Currently only used by the taiga alias loader
    custom should not show up in all_datasets
    """
    config = __get_config()
    return {
        config.get(dataset_id).original_taiga_id
        for dataset_id in config.all_datasets
        if config.get(dataset_id).original_taiga_id is not None
    }


def get_sort_key(dataset_id) -> DatasetSortKey:
    """
    Given a dataset id, return a tuple that can be used to sort datasets across the interactive config
    """
    if not has_config(dataset_id):
        raise InteractiveDatasetNotFound(
            f"{dataset_id} was not found in the interactive config"
        )

    # Immutable datasets involve more computation and are able have their order cached on current_app
    immutable_dataset_id_to_sort_keys = __get_immutable_dataset_id_to_sort_keys()
    if dataset_id in immutable_dataset_id_to_sort_keys:
        return immutable_dataset_id_to_sort_keys[dataset_id]

    else:
        # Custom and private datasets have access control and should not be cached
        assert is_custom(dataset_id) or is_private(
            dataset_id
        ), f"{dataset_id} is not custom or private but was not found in {immutable_dataset_id_to_sort_keys.keys()}. This may be a flaw in the implementation of __get_immutable_dataset_id_to_sort_keys, or an issue with testing setup."
        return DatasetSortKey(
            DatasetSortFirstKey.custom_or_private.value,
            0,
            get_dataset_label(dataset_id),
        )


def __get_immutable_dataset_id_to_sort_keys() -> DefaultDict[str, DatasetSortKey]:
    """
    This function is a cache wrapper around __format_dataset_id_to_sort_keys
    """
    dataset_id_to_sort_keys = getattr(
        current_app, "_depmap_interactive_immutable_dataset_id_to_sort_keys", None
    )
    if dataset_id_to_sort_keys is None:
        dataset_id_to_sort_keys = (
            current_app._depmap_interactive_immutable_dataset_id_to_sort_keys
        ) = __format_immutable_dataset_id_to_sort_keys()

        # Only specifying datasets that are visible to all users allows us to cache this on current app
        # Custom and private datasets can still index into this dictionary; they should fall to the dynamic function of the default dict
        assert not any(
            is_custom(dataset_id) or is_private(dataset_id)
            for dataset_id in dataset_id_to_sort_keys.keys()
        )
    return dataset_id_to_sort_keys


def __format_immutable_dataset_id_to_sort_keys() -> Dict[str, DatasetSortKey]:
    """
    Sorting aims for the following goals
        1) Custom and private datasets are the most important and should appear first (not included in this function)
        2) Generally, standard datasets appear before nonstandard
        3) Some standard datasets are more important than others. These should appear before the other standard datasets
        4) The nonstandard PR (gene_dependency) datasets should appear next to the standard gene_effect datasets (these are Chronos_Combined, etc DependencyDatasets that use the gene_effect file from taiga).
        5) Finally, we can have the rest of the nonstandard datasets

    This function takes into account all the immutable datasets (datasets that are visible to all users and can therefore be cached),
    and determines their order.
    """
    # Retrieve all immutable datasets. Only operating on immutable datasets allows us to cache the return of this function on current app
    dataset_ids_visible_to_all_users = __get_config()._immutable_datasets

    standard_dataset_display_name_to_second_key: DefaultDict = __format_standard_dataset_display_name_to_second_key()
    standard_dataset_display_names: Set[str] = __get_standard_dataset_display_names(
        dataset_ids_visible_to_all_users
    )

    dataset_id_to_sort_keys = {}

    for dataset_id in dataset_ids_visible_to_all_users:
        # the third key is always the display name
        display_name = get_dataset_label(dataset_id)
        third_key = display_name

        if is_standard(dataset_id):
            first_key = DatasetSortFirstKey.standard_or_standard_related.value
            second_key = standard_dataset_display_name_to_second_key[display_name]
        else:
            # if it is nonstandard, it might be related to a standard dataset
            related_standard_dataset_display_name = next(
                (
                    standard_dataset_display_name
                    for standard_dataset_display_name in standard_dataset_display_names
                    if display_name.startswith(standard_dataset_display_name)
                ),
                None,
            )
            if related_standard_dataset_display_name:
                # it gets the first and second keys of the standard dataset it is related to
                # we rely on the third key (display name) to sort it after the standard dataset
                # we can't always add 0.5 to the second key, since all unprioritized standard datasets have a second key
                first_key = DatasetSortFirstKey.standard_or_standard_related.value
                second_key = standard_dataset_display_name_to_second_key[
                    related_standard_dataset_display_name
                ]
            else:
                first_key = DatasetSortFirstKey.other_nonstandard.value
                second_key = 0  # the second key doesn't matter, there is no sorting within nonstandard datasets other than by display name
        dataset_id_to_sort_keys[dataset_id] = DatasetSortKey(
            first_key, second_key, third_key
        )

    return dataset_id_to_sort_keys


def __format_standard_dataset_display_name_to_second_key() -> DefaultDict[str, int]:
    """
    Returns a dictionary of { dataset display name: value of the dataset's second sort key }
    Only valid for standard datasets
    """
    # the order of this list matters and indicates priority
    prioritized_datasets = (
        Dataset.query.filter(Dataset.global_priority != None)
        .order_by(Dataset.global_priority)
        .all()
    )
    prioritized_standard_dataset_ids = [
        dataset.name.name for dataset in prioritized_datasets
    ]

    # for datasets that are not in the prioritized list, default the value to the length of the list (so that they are last)
    standard_dataset_display_name_to_second_key: DefaultDict[str, int] = defaultdict(
        lambda: len(prioritized_standard_dataset_ids)
    )

    for dataset_id in prioritized_standard_dataset_ids:
        if has_config(dataset_id):
            # the list of enums is useful for specifying prioritization, but not every dataset is present in every environment
            # E.g. in tests, or some datasets might not be public yet
            display_name = get_dataset_label(dataset_id)
            second_sort_key = prioritized_standard_dataset_ids.index(dataset_id)
            standard_dataset_display_name_to_second_key[display_name] = second_sort_key

    return standard_dataset_display_name_to_second_key


def __get_standard_dataset_display_names(
    dataset_ids_visible_to_all_users: Dict,
) -> Set[str]:
    """
    Returns a set of all standard dataset display names, used for sorting nonstandard datasets
    """
    standard_dataset_display_names = set(
        get_dataset_label(dataset_id)
        for dataset_id in dataset_ids_visible_to_all_users
        if is_standard(dataset_id)
    )
    return standard_dataset_display_names
