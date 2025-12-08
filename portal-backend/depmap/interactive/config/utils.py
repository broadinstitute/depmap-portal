from collections import defaultdict
from typing import DefaultDict, Dict, Optional, Set

from flask import current_app

from depmap.entity.models import Entity
from depmap.enums import DataTypeEnum
from depmap.dataset.models import Dataset
from depmap.download.utils import get_download_url
from depmap.interactive.config.models import (
    InteractiveConfig,
)
from depmap.predictability.utilities import (
    get_predictability_input_files_downloads_link,
)
from depmap.taiga_id import utils as taiga_utils
from depmap.utilities import entity_utils
from depmap.utilities.exception import InteractiveDatasetNotFound


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
    dataset_config = __get_config().get(dataset_id)
    return dataset_config["entity_type"]


def legacy_get_entity_class_name(dataset_id):
    """
    Returns entity type of a dataset
    """
    dataset_config = __get_config().get(dataset_id)
    return dataset_config["entity_class_name"]


def get_entity_class(dataset_id) -> Optional[Entity]:
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
