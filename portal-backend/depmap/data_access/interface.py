from typing import Optional
import pandas as pd

from depmap.data_access import breadbox_dao
from depmap.data_access.breadbox_dao import is_breadbox_id
from depmap.data_access.models import MatrixDataset
from depmap.entity.models import Entity
from depmap.interactive import interactive_utils
from depmap.interactive.common_utils import RowSummary
from depmap.interactive.config.categories import CategoryConfig
from depmap.interactive.config.models import Config, DatasetSortKey
from depmap.partials.matrix.models import CellLineSeries, Matrix

# This data access interface will eventually only contains functions
# which can be supported through both breadbox and the legacy backend.
# It is being used to more clearly delineate "legacy" data access utilities
# from the interface that will be used going forward. The majority of the
# portal should use this module for data access exclusively (and not interactive_utils).


def get_all_matrix_dataset_ids() -> set[str]:
    """
    Get the ids of all datasets which should be visible to the user. 
    Legacy dataset ids are formatted like: 'dataset_name'
    Breadbox dataset ids are formatted like: 'breadbox/<dataset-UUID>'
    The differing formats are used so that we can easily check the source of a given dataset.
    """
    legacy_dataset_ids = _get_visible_legacy_dataset_ids()
    breadbox_dataset_ids = breadbox_dao.get_all_matrix_dataset_ids()

    return legacy_dataset_ids.union(breadbox_dataset_ids)


def get_all_matrix_datasets() -> list[MatrixDataset]:
    """
    Return all matrix datasets as objects containing config values. 
    Uses a single request to breadbox to load all breadbox datasets. 
    """
    # Load breadbox datases
    breadbox_datasets = breadbox_dao.get_all_matrix_datasets()

    legacy_dataset_ids = _get_visible_legacy_dataset_ids()
    legacy_datasets = []
    for dataset_id in legacy_dataset_ids:
        legacy_datasets.append(get_matrix_dataset(dataset_id))
    return legacy_datasets + breadbox_datasets


def get_matrix_dataset(dataset_id: str) -> MatrixDataset:
    # TODO: update this to work with given ids
    if is_breadbox_id(dataset_id):
        return breadbox_dao.get_matrix_dataset(dataset_id)
    else:
        data_type = interactive_utils.get_dataset_data_type(dataset_id)
        return MatrixDataset(
            id=dataset_id,
            label=interactive_utils.get_dataset_label(dataset_id),
            data_type=data_type if data_type else None,
            feature_type=interactive_utils.get_entity_type(dataset_id),
            sample_type="depmap_model",
            priority=interactive_utils.get_dataset_priority(dataset_id),
            taiga_id=interactive_utils.get_taiga_id(dataset_id),
            units=interactive_utils.get_dataset_units(dataset_id),
            is_continuous=interactive_utils.is_continuous(dataset_id),
        )


def get_dataset_data_type(dataset_id: str) -> Optional[str]:

    """
    Get the datatype category for the given dataset.
    For example: 'rnai', 'crispr', etc.
    """
    if is_breadbox_id(dataset_id):
        return breadbox_dao.get_dataset_data_type(dataset_id)
    return interactive_utils.get_dataset_data_type(dataset_id)


def get_dataset_feature_type(dataset_id: str) -> Optional[str]:
    """
    Get the feature/entity type of the given dataset.
    For example: "gene", "compound", "compound_experiment", etc.
    """
    if is_breadbox_id(dataset_id):
        return breadbox_dao.get_dataset_feature_type(dataset_id)
    return interactive_utils.get_entity_type(dataset_id)


def get_dataset_sample_type(dataset_id: str) -> Optional[str]:
    """
    Get the sample type of the given dataset. 
    For example: "depmap_model", "screen", "model_condition", etc.
    """
    if is_breadbox_id(dataset_id):
        return breadbox_dao.get_dataset_sample_type(dataset_id)
    else:
        return "depmap_model"  # datasets from the legacy backend are always indexed by model


def get_dataset_label(dataset_id: str) -> str:
    """
    Get the user-facing label for the given dataset. 
    For example, "Copy Number (Relative, SNP only)" 
    """
    if is_breadbox_id(dataset_id):
        return breadbox_dao.get_dataset_label(dataset_id)
    return interactive_utils.get_dataset_label(dataset_id)


def get_dataset_priority(dataset_id: str) -> Optional[int]:
    """
    Get the priority of a given dataset. Priority can be used to 
    determine defaults, and the order in which datasets should be listed.
    """
    if is_breadbox_id(dataset_id):
        return breadbox_dao.get_dataset_priority(dataset_id)
    return interactive_utils.get_dataset_priority(dataset_id)


def get_dataset_taiga_id(dataset_id: str) -> Optional[str]:
    """
    Get the canonical Taiga id for the given dataset.
    """
    if is_breadbox_id(dataset_id):
        return breadbox_dao.get_dataset_taiga_id(dataset_id)
    return interactive_utils.get_taiga_id(dataset_id)


def get_dataset_units(dataset_id: str) -> Optional[str]:
    """
    Get the units label for the given dataset. 
    For example: "Gene Effect", "CERES Score", etc.
    """
    if is_breadbox_id(dataset_id):
        return breadbox_dao.get_dataset_units(dataset_id)
    return interactive_utils.get_dataset_units(dataset_id)


def get_row_of_values(dataset_id: str, feature: str) -> CellLineSeries:
    """
    Gets a row of numeric or string values, indexed by depmap_id
    for a given dataset and feature name.
    """
    if is_breadbox_id(dataset_id):
        return breadbox_dao.get_row_of_values(dataset_id=dataset_id, feature=feature)
    return interactive_utils.get_row_of_values(dataset_id=dataset_id, feature=feature)


def get_subsetted_df_by_labels(
    dataset_id: str,
    feature_row_labels: Optional[list[str]] = None,
    sample_col_ids: Optional[list[str]] = None,
) -> pd.DataFrame:
    """
    Load a dataframe with only the specified rows (features) and columns (cell_lines).
    If no row or column labels are specified, all values will be returned
    including values without sample/entity metadata. The dataframe returned 
    should have columns named by depmap_id and rows named by entity/feature label. 
    """
    if is_breadbox_id(dataset_id):
        return breadbox_dao.get_subsetted_df_by_labels(
            dataset_id, feature_row_labels, sample_col_ids
        )
    return interactive_utils.get_subsetted_df_by_labels(
        dataset_id, feature_row_labels, sample_col_ids
    )


def get_dataset_feature_labels_by_id(dataset_id) -> dict[str, str]:
    """
    Get a mapping of feature labels to given IDs.
    Other data loading methods return dataframes indexed by labels, but there are occasional
    times where we need the IDs as well. This makes it easy to map between the two.
    """
    if is_breadbox_id(dataset_id):
        return breadbox_dao.get_dataset_feature_labels_by_id(dataset_id)
    return interactive_utils.get_dataset_feature_labels_by_id(dataset_id)


def get_dataset_sample_labels_by_id(dataset_id) -> dict[str, str]:
    """
    Get a mapping of sample labels to given IDs.
    For example, depmap models use cell line names as labels and depmap (ACH) IDs as given IDs. 
    """
    if is_breadbox_id(dataset_id):
        return breadbox_dao.get_dataset_sample_labels_by_id(dataset_id)
    return interactive_utils.get_dataset_sample_labels_by_id(dataset_id)


def get_dataset_feature_labels(dataset_id: str) -> list[str]:
    """
    Get a list of all feature/entity labels for the given dataset.
    """
    if is_breadbox_id(dataset_id):
        return breadbox_dao.get_dataset_feature_labels(dataset_id)
    return interactive_utils.get_dataset_feature_labels(dataset_id)


def get_dataset_sample_ids(dataset_id: str) -> list[str]:
    """
    Get a list of all sample ids (ex. depmap ids) for the given dataset.
    """
    if is_breadbox_id(dataset_id):
        return breadbox_dao.get_dataset_sample_ids(dataset_id)
    return interactive_utils.get_dataset_sample_ids(dataset_id)


def get_sort_key(dataset_id: str) -> DatasetSortKey:
    """
    Get a DatasetSortKey to order datasets as they should appear in vector catalog.
    This method is only used in DE1. DE2 uses the 'priority' field instead.
    """
    if is_breadbox_id(dataset_id):
        return breadbox_dao.get_sort_key(dataset_id)
    return interactive_utils.get_sort_key(dataset_id)


def is_categorical(dataset_id: str) -> bool:
    """
    Check whether the given dataset is made up of categorical values
    For example, lineage is a categorical dataset. 
    """
    if is_breadbox_id(dataset_id):
        return breadbox_dao.is_categorical(dataset_id)
    return interactive_utils.is_categorical(dataset_id)


def is_continuous(dataset_id: str) -> bool:
    """
    Check whether the given dataset is made up of continuous values
    For example, gene effect datasets are continuous.
    """
    if is_breadbox_id(dataset_id):
        return breadbox_dao.is_continuous(dataset_id)
    return interactive_utils.is_continuous(dataset_id)


def valid_row(dataset_id: str, row_name: str) -> bool:
    """
    Check whether the given entity label exists in the given dataset.
    """
    if is_breadbox_id(dataset_id):
        return breadbox_dao.valid_row(dataset_id, row_name)
    return interactive_utils.valid_row(dataset_id, row_name)


# This could be supported by breadbox but isn't very useful for DE2 because
# we can use get_row_of_values just as easily to load data when we have the feature label.
def get_row_of_values_from_slice_id(id: str) -> CellLineSeries:
    """
    Gets a row of numeric or string values, indexed by depmap_id
    for a given slice_id.
    """
    return interactive_utils.get_row_of_values_from_slice_id(id)


######################################################################
# METHODS BELOW NEED UPDATED CONTRACTS TO BE SUPPORTABLE BY BREADBOX #
######################################################################

# used heavily by data explorer 2 to distinguish private datasets when caching
def get_private_datasets() -> dict[str, Config]:
    """
    Get configuration information for all private datasets.
    """
    return interactive_utils.get_private_datasets()


# Not currently used anywhere
def get_all_entity_ids(dataset_id: str) -> list[int]:
    """
    Get all entity ids for a given dataset. 
    Entity ids are the entity PK values in the legacy database, used to join
    entity metadata with matrix data. 
    """
    return interactive_utils.get_all_entity_ids(dataset_id)


def get_subsetted_df(
    dataset_id: str, row_indices: Optional[list[int]], col_indices: Optional[list[int]]
) -> pd.DataFrame:
    """
    Load a dataframe with only the specified rows and columns.
    If no row/column indices are specified, all values will be returned
    including values without sample/entity metadata. 
    """
    return interactive_utils.get_subsetted_df(
        dataset_id=dataset_id, row_indices=row_indices, col_indices=col_indices
    )


def get_subsetted_df_by_ids(
    dataset_id: str,
    entity_ids: Optional[list[int]] = None,
    cell_line_ids: Optional[list[str]] = None,
) -> pd.DataFrame:
    """
    Load a dataframe contianing a subset of the data belonging to the dataset. 
    Index the subset using entity/cell line ids instead of row/column indices (as is done in get_subsetted_df).
    If no entity ids or cell line ids are given, all values will be returned
    including values without sample/entity metadata.
    """

    return interactive_utils.get_subsetted_df_by_ids(
        dataset_id=dataset_id, entity_ids=entity_ids, cell_line_ids=cell_line_ids,
    )


##########################################################
# METHODS BELOW ARE COMPLETELY UNSUPPORTABLE BY BREADBOX #
##########################################################


# only used in cell line page
def get_all_row_indices_labels_entity_ids(dataset_id: str) -> list[RowSummary]:
    """
    Gets RowSummary objects: including index, entity ID, and label for each row.
    Entity id may be none in the case of nonstandard datasets that use label only.
    """
    return interactive_utils.get_all_row_indices_labels_entity_ids(dataset_id)


# Only used in /api/get-features (DE1)
def get_category_config(color_dataset: str) -> CategoryConfig:
    """
    Gets a config object describing the categories for the given dataset.
    """
    return interactive_utils.get_category_config(color_dataset)


def get_context_dataset() -> str:
    """
    Get the id of the context dataset.
    """
    return interactive_utils.get_context_dataset()


# Only used in DE1 and custom analysis
def get_custom_cell_lines_dataset() -> str:
    """
    Get the id of the custom cell lines dataset.
    """
    return interactive_utils.get_custom_cell_lines_dataset()


# Currently only used by Vector Catalog
# Breadbox can support a function that does this, but it shouldn't live in this data access interface.
# Rather, in our files that correspond to tables and DB Models (ie: models.py) we could have a function
# to convert an entity type to the corresponding entity class.
# And we can use GenericEntity as a catch all for anything not recognized.
def get_entity_class(dataset_id: str) -> Entity:
    """
    Gets the entity subclass which represents the entity type for the given dataset. 
    Each entity subclass maps to a legacy database table which stores entity metadata
    For example, Gene, Compound, Antibody, etc.
    """
    return interactive_utils.get_entity_class(dataset_id)


def get_matrix(dataset_id: str) -> Matrix:
    """
    Load the matrix object for the given dataset.
    Matrices are specific to the legacy data access implementation
    """
    return interactive_utils.get_matrix(dataset_id)


def get_matrix_id(dataset_id: str) -> int:
    """
    Load the matrix id for the given dataset.
    Matrices are specific to the legacy data access implementation
    """
    return interactive_utils.get_matrix_id(dataset_id)


def has_config(dataset_id: str) -> bool:
    """
    Check whether the given dataset exists in interactive config
    """
    return interactive_utils.has_config(dataset_id)


def has_opaque_features(dataset_id: str) -> bool:
    return interactive_utils.has_opaque_features(dataset_id)


def is_filter(dataset_id: str) -> bool:
    """
    Check whether the given dataset is a context or custom cell lines dataset.
    """
    return interactive_utils.is_filter(dataset_id)


def is_standard(dataset_id: str) -> bool:
    """
    Check whether the given dataset is standard or nonstandard. 
    Only applicable for the legacy data access implementation.
    """
    return interactive_utils.is_standard(dataset_id)


def _get_visible_legacy_dataset_ids():
    """
    Determine which legacy datasets should be hidden because they
    have been copied to breadbox. 
    """
    legacy_dataset_ids = interactive_utils.get_all_dataset_ids()
    breadbox_given_ids = breadbox_dao.get_breadbox_given_ids()

    return legacy_dataset_ids - breadbox_given_ids
