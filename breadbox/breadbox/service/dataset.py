import json
import logging
import pandas as pd
from typing import Any, Dict, Optional

from breadbox.crud.access_control import user_has_access_to_group
from breadbox.crud import dataset as dataset_crud
from breadbox.db.session import SessionWithUser
from breadbox.io.data_validation import annotation_type_to_pandas_column_type
from breadbox.io.filestore_crud import get_slice
from breadbox.models.dataset import AnnotationType, MatrixDataset, TabularDataset
from breadbox.schemas.dataset import (
    ColumnMetadata,
    FeatureSampleIdentifier,
    MatrixDimensionsInfo,
    TabularDimensionsInfo,
)
from breadbox.schemas.custom_http_exception import UserError, DatasetAccessError
from breadbox.service import metadata as metadata_service

log = logging.getLogger(__name__)


def get_subsetted_matrix_dataset_df(
    db: SessionWithUser,
    user: str,
    dataset: MatrixDataset,
    dimensions_info: MatrixDimensionsInfo,
    filestore_location,
    strict: bool = False,  # False default for backwards compatibility
):
    """
    Load a dataframe containing data for the specified dimensions.
    If the dimensions are specified by label, then return a result indexed by labels
    """

    missing_features = []
    missing_samples = []

    if dimensions_info.features is None:
        feature_indexes = None
    elif dimensions_info.feature_identifier.value == "id":
        (
            feature_indexes,
            missing_features,
        ) = dataset_crud.get_feature_indexes_by_given_ids(
            db, user, dataset, dimensions_info.features
        )
    else:
        assert dimensions_info.feature_identifier.value == "label"
        (
            feature_indexes,
            missing_features,
        ) = metadata_service.get_dimension_indexes_of_labels(
            db, user, dataset, axis="feature", dimension_labels=dimensions_info.features
        )

    if len(missing_features) > 0:
        log.warning(f"Could not find features: {missing_features}")

    if dimensions_info.samples is None:
        sample_indexes = None
    elif dimensions_info.sample_identifier.value == "id":
        sample_indexes, missing_samples = dataset_crud.get_sample_indexes_by_given_ids(
            db, user, dataset, dimensions_info.samples
        )
    else:
        (
            sample_indexes,
            missing_samples,
        ) = metadata_service.get_dimension_indexes_of_labels(
            db, user, dataset, axis="sample", dimension_labels=dimensions_info.samples
        )

    if len(missing_samples) > 0:
        log.warning(f"Could not find samples: {missing_samples}")

    if strict:
        num_missing_features = len(missing_features)
        missing_features_msg = f"{num_missing_features} missing features: {missing_features[:20] + ['...'] if num_missing_features >= 20 else missing_features}"
        num_missing_samples = len(missing_samples)
        missing_samples_msg = f"{num_missing_samples} missing samples: {missing_samples[:20] + ['...'] if num_missing_samples >= 20 else missing_samples}"
        if len(missing_features) > 0 or len(missing_samples) > 0:
            raise UserError(f"{missing_features_msg} and {missing_samples_msg}")

    # call sort on the indices because hdf5_read requires indices be in ascending order
    if feature_indexes is not None:
        feature_indexes = sorted(feature_indexes)
    if sample_indexes is not None:
        sample_indexes = sorted(sample_indexes)

    df = get_slice(dataset, feature_indexes, sample_indexes, filestore_location)

    # Re-index by label if applicable
    if dimensions_info.feature_identifier == FeatureSampleIdentifier.label:
        labels_by_id = metadata_service.get_matrix_dataset_feature_labels_by_id(
            db, user, dataset
        )
        df = df.rename(columns=labels_by_id)

    if dimensions_info.sample_identifier == FeatureSampleIdentifier.label:
        label_by_id = metadata_service.get_matrix_dataset_sample_labels_by_id(
            db, user, dataset
        )
        df = df.rename(index=label_by_id)

    return df


def get_subsetted_tabular_dataset_df(
    db: SessionWithUser,
    user: str,
    dataset: TabularDataset,
    tabular_dimensions_info: TabularDimensionsInfo,
    strict: bool,
) -> pd.DataFrame:
    """
    Load a dataframe containing data for the specified indices and columns.
    If the indices are specified by label, then return a result indexed by labels
    If either indices or columns are not specified, return all indices or columns
    By default, if indices and identifier not specified, then dimension ids are used as identifier
    """
    if not user_has_access_to_group(dataset.group, user, write_access=True):
        raise DatasetAccessError(f"User {user} does not have access to dataset")

    # If labels were given as the filter, get the corresponding set of given ids
    dataset_labels_by_id = metadata_service.get_tabular_dataset_labels_by_id(
        db, dataset
    )
    if tabular_dimensions_info.identifier == FeatureSampleIdentifier.label:
        if tabular_dimensions_info.indices is None:
            user_specified_given_ids = None
        else:
            user_specified_given_ids = [
                id
                for id, label in dataset_labels_by_id.items()
                if label in tabular_dimensions_info.indices
            ]
    else:
        if tabular_dimensions_info.indices is None:
            user_specified_given_ids = None
        else:
            user_specified_given_ids = tabular_dimensions_info.indices

    tabular_subset_df = dataset_crud.get_subset_of_tabular_data_as_df(
        db=db,
        dataset=dataset,
        column_names=tabular_dimensions_info.columns,
        index_given_ids=user_specified_given_ids,
    )

    if tabular_dimensions_info.identifier == FeatureSampleIdentifier.label:
        # Rename the resulting column with dimension ids to their labels
        tabular_subset_df = tabular_subset_df.rename(index=dataset_labels_by_id)

    # If 'strict' raise error for missing values
    if strict:
        missing_columns, missing_indices = _get_missing_tabular_columns_and_indices(
            tabular_subset_df,
            tabular_dimensions_info.columns,
            tabular_dimensions_info.indices,
            dataset.id,
        )
        if missing_columns or missing_indices:
            raise UserError(
                msg=_get_truncated_message(missing_columns, missing_indices)
            )

    if tabular_subset_df.empty:
        return tabular_subset_df

    # set typing for columns
    col_dtypes = _get_column_types(
        dataset.columns_metadata, tabular_dimensions_info.columns
    )
    tabular_subset_df = _convert_subsetted_tabular_df_dtypes(
        tabular_subset_df, col_dtypes, dataset.columns_metadata
    )
    return tabular_subset_df


def _convert_subsetted_tabular_df_dtypes(
    df: pd.DataFrame,
    dtype_map: Dict[str, Any],
    dataset_columns_metadata: Dict[str, ColumnMetadata],
):
    # Replace string boolean values with boolean
    for col, dtype in dtype_map.items():
        column = df[col]
        if dtype == pd.BooleanDtype():
            column = column.replace({"True": True, "False": False})
        column = column.astype(dtype)
        # NOTE: if col type is list string, convert to list. col dtype will be changed to object
        if (
            dtype == pd.StringDtype()
            and dataset_columns_metadata[col].col_type == AnnotationType.list_strings
        ):
            column = column.apply(lambda x: json.loads(x) if x is not pd.NA else x)
        df[col] = column
    return df


def _get_missing_tabular_columns_and_indices(
    df, tabular_columns, tabular_indices, dataset_id
):
    missing_columns = set()
    missing_indices = set()
    if tabular_columns is not None:
        missing_columns = set(tabular_columns).difference(df.columns)
        if len(missing_columns) > 0:
            log.warning(
                f"In get_subsetted_tabular_dataset_df, missing columns: {missing_columns} for dataset: {dataset_id}"
            )

    if tabular_indices is not None:
        missing_indices = set(tabular_indices).difference(df.index)
        if len(missing_indices) > 0:
            log.warning(
                f"In get_subsetted_tabular_dataset_df, missing indices: {missing_indices} for dataset: {dataset_id}"
            )

    return missing_columns, missing_indices


def _get_truncated_message(missing_tabular_columns, missing_tabular_indices):
    num_missing_cols = len(missing_tabular_columns)
    num_missing_indices = len(missing_tabular_indices)
    shown_missing_cols = (
        missing_tabular_columns[:20] + ["..."]
        if num_missing_cols >= 20
        else missing_tabular_columns
    )
    shown_missing_indices = (
        missing_tabular_indices[:20] + ["..."]
        if num_missing_indices >= 20
        else missing_tabular_indices
    )
    return f"{num_missing_cols} missing columns: {shown_missing_cols} and {num_missing_indices} missing indices: {shown_missing_indices}"


def _get_column_types(columns_metadata, columns: Optional[list[str]]):
    col_and_column_metadata_pairs = columns_metadata.items()
    if columns is None:
        return {
            col: annotation_type_to_pandas_column_type(column_metadata.col_type)
            for col, column_metadata in col_and_column_metadata_pairs
        }

    else:
        column_types = {}
        for col, column_metadata in col_and_column_metadata_pairs:
            if col in columns:
                column_types[col] = annotation_type_to_pandas_column_type(
                    column_metadata.col_type
                )

        return column_types
