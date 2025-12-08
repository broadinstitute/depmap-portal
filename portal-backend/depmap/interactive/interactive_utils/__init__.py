# This file contains the public API for the "Interactive Config". All code that wants to use the interactive config
# methods should import them from here. (ie: import depmap.interactive.interactive_utils)

# Ideally, all data storage implementation details should be hidden behind this API
# and the API contract should be one which can be supported by either breadbox or the legacy interactive_config implementations.
# The interface defined here is evolving as the breadbox integration proceeds.

########################################################
# METHODS WHICH HAVE BEEN DEFINED IN THE NEW INTERFACE #
# and should be referenced from there going forward    #
########################################################

from .config_groups import (
    get_all_dataset_ids,
)

from depmap.interactive.config.utils import (
    get_dataset_data_type,
    get_dataset_label,
    get_dataset_priority,
    get_dataset_units,
    get_dataset_url,
    get_entity_type,
    get_taiga_id,
    # the functions listed below should eventually be removed from this interface
    get_entity_class,  # only used in InteractiveTree, which is only used in constellation/celfie
    get_matrix_id,  # only used in old compound page functionality which is no longer needed
)

from .get_and_process_data import (
    is_categorical,
    is_continuous,
    has_config,
    get_context_dataset,  # only used in predictability
    get_dataset_feature_labels_by_id,
    get_dataset_feature_labels,
    get_dataset_sample_ids,
    get_dataset_sample_labels_by_id,
    get_row_of_values,
    get_subsetted_df_by_labels,
    valid_row,
)


##################################################
# METHODS USED ONLY IN THE DATA LOADER AND TESTS #
##################################################

from depmap.interactive.config.utils import (
    get_all_original_taiga_ids,  # used in loader and tests
    get_original_taiga_id,  # used in loader and tests
    get_feature_example,  # used in tests
)

#######################################
# METHODS USED ONLY BY VECTOR CATALOG #
#######################################

from .config_groups import (
    get_noncustom_continuous_datasets_not_gene_or_compound,
    get_nonstandard_categorical_datasets,
    is_custom,
)

from depmap.interactive.config.utils import get_feature_name
