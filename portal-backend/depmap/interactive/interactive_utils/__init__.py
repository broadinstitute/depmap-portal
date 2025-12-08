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
    get_entity_class,  # only used in InteractiveTree, which is only used for associations
    get_matrix_id,  # only used in old compound page functionality
)

from .get_and_process_data import (
    is_categorical,  # used by get-features and get_assocations (pre-computed correlations)
    is_continuous,  # heavily used
    is_standard,  # 4 uses: associations, downloads, and vector catalog
    has_config,  # 2 uses: compound tiles, "check_nonstandard_datasets" command
    get_all_entity_ids,  # not currently used
    get_all_row_indices_labels_entity_ids,  # 9 uses: custom analysis, cell line view, compound views, downloads
    get_category_config,  # used only by get-features calls which involve custom analysis two class comparisons
    get_context_dataset,  # 6 uses, mostly vector catalog, also predictability
    get_custom_cell_lines_dataset,  # used in custom analysis, DE1, and in other interactive function implementations
    get_dataset_feature_ids,
    get_dataset_feature_labels_by_id,
    get_dataset_feature_labels,
    get_dataset_sample_ids,
    get_dataset_sample_labels_by_id,
    get_matrix,  # downloads: check dataset size
    get_row_of_values,  # very heavily used
    get_subsetted_df,  # 19 uses: custom analysis, cell line view, compound view, etc.
    get_subsetted_df_by_ids,  # Used by custom downloads and context explorer
    get_subsetted_df_by_labels,
    # Used by /api/get-features (DE1), /api/assocations (pre-computed correlations), and /api/associations-csv
    # The places that use this aren't using the best approach to validation and should probably be changed
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
from .get_and_process_data import (
    get_all_rows,
    get_matching_row_entity_ids,
    get_matching_rows,
    is_prepopulate,
    # methods which return the name of a dataset
    get_tumor_type_dataset,
    get_disease_subtype_dataset,
    get_gender_dataset,
    get_growth_pattern_dataset,
    get_lineage_dataset,
    get_primary_disease_dataset,
)

from .config_groups import (
    get_noncustom_continuous_datasets_not_gene_or_compound,
    get_nonstandard_categorical_datasets,
    is_custom,
)

from depmap.interactive.config.utils import get_feature_name
