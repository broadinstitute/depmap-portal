import json
from breadbox.crud import dataset as dataset_crud
from breadbox.io.data_validation import annotation_type_to_pandas_column_type
from breadbox.io.filestore_crud import get_slice
from breadbox.schemas.dataset import (
    FeatureSampleIdentifier,
    MatrixDimensionsInfo,
    TabularDimensionsInfo,
)
from breadbox.service import metadata as metadata_service
import logging
from ..schemas.dataset import (
    MatrixDatasetIn,
    ColumnMetadata,
)

from ..schemas.custom_http_exception import DatasetAccessError
from breadbox.crud.access_control import user_has_access_to_group
from breadbox.models.dataset import MatrixDataset
from breadbox.crud.group import (
    get_group,
    TRANSIENT_GROUP_ID,
    get_transient_group,
)
from ..crud.types import get_dimension_type
from ..crud.dataset import add_tabular_dimensions, add_matrix_dataset_dimensions
from ..crud.types import (
    add_dimension_type,
    set_properties_to_index,
    add_metadata_dimensions,
    update_dataset_dimensions_with_dimension_type,
)

from ..service.search import populate_search_index
from typing import Any, Dict, List, Literal, Optional, Type, Union
from uuid import uuid4

import pandas as pd

from breadbox.schemas.types import UpdateDimensionType
from breadbox.db.session import SessionWithUser
from breadbox.config import Settings
from breadbox.crud.access_control import PUBLIC_GROUP_ID
from breadbox.crud.dataset import (
    delete_dataset,
    get_dataset,
)
from breadbox.io.data_validation import validate_all_columns_have_types
from breadbox.schemas.custom_http_exception import UserError, ResourceNotFoundError
from breadbox.schemas.dataset import TabularDatasetIn
from breadbox.models.dataset import (
    AnnotationType,
    TabularDataset,
    DatasetSample,
    DatasetFeature,
    DimensionType,
)


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


def add_tabular_dataset(
    db: SessionWithUser,
    user: str,
    dataset_in: TabularDatasetIn,
    data_df: pd.DataFrame,
    columns_metadata: Dict[str, ColumnMetadata],
    dimension_type: DimensionType,
    short_name: Optional[str],
    version: Optional[str],
    description: Optional[str],
):
    # verify the id_column is present in the data frame before proceeding and is of type string
    if dimension_type.id_column not in data_df.columns:
        raise ValueError(
            f'The dimension type "{dimension_type.name}" uses "{dimension_type.id_column}" for the ID, however that column is not present in the table. The actual columns were: {data_df.columns.to_list()}'
        )

    group = _get_dataset_group(db, user, dataset_in.group_id, dataset_in.is_transient)
    dataset = TabularDataset(
        id=dataset_in.id,
        given_id=dataset_in.given_id,
        name=dataset_in.name,
        index_type_name=dataset_in.index_type_name,
        data_type=dataset_in.data_type,
        is_transient=dataset_in.is_transient,
        group_id=group.id,
        priority=dataset_in.priority,
        taiga_id=dataset_in.taiga_id,
        dataset_metadata=dataset_in.dataset_metadata,
        md5_hash=dataset_in.dataset_md5,
        short_name=short_name,
        version=version,
        description=description,
    )
    db.add(dataset)
    db.flush()

    _validate_tabular_dimensions(db, dimension_type, columns_metadata, data_df)
    add_tabular_dimensions(
        db, data_df, columns_metadata, dataset.id, dimension_type, group_id=group.id
    )

    db.flush()

    return dataset


def _validate_tabular_dimensions(
    db: SessionWithUser,
    dimension_type: DimensionType,
    columns_metadata: Dict[str, ColumnMetadata],
    data_df: pd.DataFrame,
):

    assert (
        dimension_type.id_column in data_df.columns
    ), f"id column was specified as {dimension_type.id_column} but dataframe only had columns {data_df.columns}"

    missing_metadata = set(data_df.columns).difference(columns_metadata)
    if len(missing_metadata) > 0:
        raise ValueError(
            f"The following columns are missing metadata: {', '.join(missing_metadata)}"
        )
    extra_metadata = set(columns_metadata).difference(data_df.columns)
    if len(extra_metadata) > 0:
        raise ValueError(
            f"The following columns had metadata but are not present in the table: {', '.join(extra_metadata)}"
        )

    for column_name, column_metadata in columns_metadata.items():
        if column_metadata.references is not None:
            dim_type = get_dimension_type(db, column_metadata.references)
            if dim_type is None:
                raise ValueError(
                    f"The column {column_name} references {column_metadata.references} which does not exit"
                )


def _get_dataset_group(
    db: SessionWithUser, user: str, group_id: str, is_transient: bool
):
    # I don't really like this approach, but it's needed to support create_cell_line_group which
    # creates some transient datasets. I think we haven't really thought through the role of groups
    # and transient datasets. Every dataset needs a group, and so we have TRANSIENT_GROUP_ID that should be the
    # owner of all transient datasets. Perhaps we should make group optional if isTransient is set? Or
    # we could silently ignore the group_id in this case. For now, assert it's set appropriately

    if is_transient:
        if str(group_id) != TRANSIENT_GROUP_ID:
            raise UserError(
                f"If creating a transient dataset, the group must be set to {TRANSIENT_GROUP_ID}"
            )
        group = get_transient_group(db)
    else:
        group = get_group(db, user, group_id, write_access=True)
    assert group is not None
    return group


def add_matrix_dataset(
    db: SessionWithUser,
    user: str,
    dataset_in: MatrixDatasetIn,
    feature_given_id_and_index_df: pd.DataFrame,
    sample_given_id_and_index_df: pd.DataFrame,
    feature_type: Optional[DimensionType],
    sample_type: DimensionType,
    short_name: Optional[str],
    version: Optional[str],
    description: Optional[str],
):
    group = _get_dataset_group(db, user, dataset_in.group_id, dataset_in.is_transient)

    allowed_values = dataset_in.allowed_values

    dataset = MatrixDataset(
        id=dataset_in.id,
        given_id=dataset_in.given_id,
        name=dataset_in.name,
        units=dataset_in.units,
        feature_type_name=dataset_in.feature_type_name,
        sample_type_name=dataset_in.sample_type_name,
        data_type=dataset_in.data_type,
        is_transient=dataset_in.is_transient,
        group_id=group.id,
        value_type=dataset_in.value_type,
        priority=dataset_in.priority,
        taiga_id=dataset_in.taiga_id,
        allowed_values=allowed_values if allowed_values else None,
        dataset_metadata=dataset_in.dataset_metadata,
        md5_hash=dataset_in.dataset_md5,
        short_name=short_name,
        description=description,
        version=version,
    )
    db.add(dataset)
    db.flush()

    add_matrix_dataset_dimensions(
        db=db,
        index_and_given_id=feature_given_id_and_index_df,
        dimension_subtype_cls=DatasetFeature,
        dimension_type_name=feature_type.name if feature_type else None,
        dataset=dataset,
    )
    add_matrix_dataset_dimensions(
        db=db,
        index_and_given_id=sample_given_id_and_index_df,
        dimension_subtype_cls=DatasetSample,
        dimension_type_name=sample_type.name,
        dataset=dataset,
    )

    db.flush()

    return dataset


def add_dimension_type(
    db: SessionWithUser,
    settings: Settings,
    user: str,
    name: str = "Sample Dimension Type",
    id_column: str = "label",
    axis: Literal["feature", "sample"] = "feature",
    display_name: Optional[str] = None,
    metadata_df: Optional[pd.DataFrame] = None,
    annotation_type_mapping: Optional[Dict[str, AnnotationType]] = None,
    reference_column_mappings: Optional[Dict[str, str]] = None,
    properties_to_index: Optional[List[str]] = None,
    taiga_id: Optional[str] = None,
    units_per_column: Optional[Dict[str, str]] = None,
):
    if reference_column_mappings is None:
        reference_column_mappings = {}

    assert user in settings.admin_users

    if metadata_df is not None:
        assert id_column is not None
        if annotation_type_mapping is None:
            raise UserError(
                "If metadata file is provided, you must also provide annotation type mapping",
            )

        validate_all_columns_have_types(
            list(metadata_df.columns), annotation_type_mapping
        )

        dataset_id = str(uuid4())

        dataset = TabularDatasetIn(
            id=dataset_id,
            name=f"{name} metadata",
            index_type_name=name,
            data_type="User upload",
            is_transient=False,
            group_id=PUBLIC_GROUP_ID,
            taiga_id=taiga_id,
            given_id=None,
            priority=None,
            dataset_metadata=None,
            dataset_md5=None,  # This may change!
        )

        check_id_mapping_is_valid(db, reference_column_mappings)

        dimension_type = add_dimension_type(
            db,
            name=name,
            display_name=display_name,
            id_column=id_column,
            axis=axis,
            dataset_in=dataset,
            metadata_df=metadata_df,
            annotation_type_mapping=annotation_type_mapping,
            reference_column_mappings=reference_column_mappings,
            properties_to_index=properties_to_index,
            units_per_column=units_per_column,
        )

    else:
        if taiga_id is not None:
            raise UserError(
                "If taiga ID is specified, you must also provide a metadata file"
            )

        dimension_type = add_dimension_type(
            db, name=name, display_name=display_name, id_column=id_column, axis=axis,
        )

    populate_search_index(db, dimension_type)

    return dimension_type


def _check_id_mapping_is_valid(
    db: SessionWithUser, reference_column_mappings: Dict[str, str]
):
    for _, reference_table_feature_type_name in reference_column_mappings.items():
        assert isinstance(reference_table_feature_type_name, str)
        referenced_dataset_id = (
            db.query(DimensionType)
            .filter(DimensionType.name == reference_table_feature_type_name)
            .with_entities(DimensionType.dataset_id)
            .one_or_none()
        )

        if not referenced_dataset_id:
            return False

    return True


def check_id_mapping_is_valid(
    db: SessionWithUser, reference_column_mappings: Dict[str, str]
):
    if not _check_id_mapping_is_valid(db, reference_column_mappings):
        raise UserError(
            "Attempted reference mapping to a dimension type that does not exist!"
        )


def update_dimension_type(
    db: SessionWithUser,
    user: str,
    filestore_location: str,
    dimension_type: DimensionType,
    dimension_type_update_fields: UpdateDimensionType,
):
    given_updated_fields = dimension_type_update_fields.dict(exclude_unset=True)

    if (
        "metadata_dataset_id" in given_updated_fields
        and "properties_to_index" in given_updated_fields
    ):
        metadata_dataset = get_dataset(
            db, user, given_updated_fields["metadata_dataset_id"]
        )
        if metadata_dataset is None:
            raise ResourceNotFoundError(
                f"Metadata table {given_updated_fields['metadata_dataset_id']} not found"
            )

        if not isinstance(metadata_dataset, TabularDataset):
            raise ResourceNotFoundError(
                f"Metadata table {given_updated_fields['metadata_dataset_id']} was not a tabular dataset",
            )

        if metadata_dataset.index_type_name != dimension_type.name:
            raise ResourceNotFoundError(
                f"Metadata table {given_updated_fields['metadata_dataset_id']} was not indexed by {dimension_type.name}",
            )

        if dimension_type.dataset != metadata_dataset:
            assert metadata_dataset.index_type_name == dimension_type.name
            old_dataset = dimension_type.dataset
            dimension_type.dataset = metadata_dataset

            # make sure the metadata dataset is marked as non-transient and is in the public group
            if metadata_dataset.is_transient:
                metadata_dataset.is_transient = False  # pyright: ignore

            if metadata_dataset.group_id != PUBLIC_GROUP_ID:
                metadata_dataset.group_id = PUBLIC_GROUP_ID  # pyright: ignore

            if old_dataset is not None:
                delete_dataset(db, user, old_dataset, filestore_location)

        db.flush()
        set_properties_to_index(
            db,
            given_updated_fields["properties_to_index"],
            dimension_type.name,
            metadata_dataset.group_id,
        )

        populate_search_index(db, dimension_type)

    if "display_name" in given_updated_fields:
        dimension_type.display_name = given_updated_fields["display_name"]

    db.flush()


def update_dimension_type_metadata(
    db: SessionWithUser,
    user: str,
    filestore_location: str,
    dimension_type: DimensionType,
    file_name: Optional[str],
    metadata_df: pd.DataFrame,
    annotation_type_mapping: Dict[str, AnnotationType],
    taiga_id: Optional[str],
    reference_column_mappings: Optional[Dict[str, str]] = None,
    properties_to_index: Optional[List[str]] = None,
    units_per_column: Optional[Dict[str, str]] = None,
) -> DimensionType:
    if file_name is None:
        file_name = "metadata"

    if units_per_column is None:
        units_per_column = {}

    if reference_column_mappings is None:
        reference_column_mappings = {}

    if dimension_type.dataset is not None:
        # before deleting the dataset, save the current list of properties to index if the caller didn't supply
        # a list.
        if properties_to_index is None:
            properties_to_index = [
                x.property for x in dimension_type.dataset.properties_to_index
            ]

        # Delete dataset; cascade deletes annotation dimensions which then deletes all annotation values
        is_deleted = delete_dataset(
            db, user, dimension_type.dataset, filestore_location
        )
        if not is_deleted:
            raise PermissionError("User cannot modify this dataset!")

    dataset_id = str(uuid4())
    dimension_type_metadata = TabularDataset(
        id=dataset_id,
        name=file_name,
        index_type_name=dimension_type.name,
        data_type="User upload",
        is_transient=False,
        group_id=PUBLIC_GROUP_ID,
        taiga_id=taiga_id,
    )
    db.add(dimension_type_metadata)

    db.flush()
    dimension_type.dataset_id = dataset_id  # pyright: ignore
    db.flush()
    db.refresh(dimension_type)

    add_metadata_dimensions(
        db=db,
        annotations_df=metadata_df,
        annotation_type_mapping=annotation_type_mapping,
        dataset_dimension_type_name=dimension_type.name,
        id_column=dimension_type.id_column,
        dataset=dimension_type_metadata,
        units_per_column=units_per_column,
        reference_column_mappings=reference_column_mappings,
    )
    update_dataset_dimensions_with_dimension_type(db, dimension_type, metadata_df)

    if properties_to_index and len(properties_to_index) > 0:
        db.flush()
        set_properties_to_index(
            db,
            properties_to_index,
            dimension_type.name,
            dimension_type_metadata.group_id,
        )

    db.flush()

    populate_search_index(db, dimension_type)

    db.flush()
    return dimension_type
