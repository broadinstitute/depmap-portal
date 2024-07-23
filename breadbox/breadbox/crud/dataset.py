import logging
from collections import defaultdict
from dataclasses import dataclass
from typing import Dict, Optional, List, Type, Union, Tuple
from uuid import UUID, uuid4
import warnings

import pandas as pd
import numpy as np
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import aliased, with_polymorphic

from breadbox.db.session import SessionWithUser
from ..io.data_validation import dimension_label_df_schema
from ..schemas.dataset import (
    MatrixDatasetIn,
    TabularDatasetIn,
    DatasetUpdateParams,
    DimensionSearchIndexResponse,
    FeatureSampleIdentifier,
    MatrixDimensionsInfo,
    ColumnMetadata,
    TabularDimensionsInfo,
)
from ..schemas.custom_http_exception import (
    DatasetAccessError,
    ResourceNotFoundError,
    UserError,
)
from breadbox.crud.access_control import user_has_access_to_group
from ..models.dataset import (
    AnnotationType,
    Dataset,
    MatrixDataset,
    TabularDataset,
    DatasetFeature,
    DatasetReference,
    DatasetSample,
    Dimension,
    DimensionSearchIndex,
    TabularColumn,
    TabularCell,
    CatalogNode,
    PropertyToIndex,
    ValueType,
    DimensionType,
)
from breadbox.crud.group import (
    get_group,
    get_groups_with_visible_contents,
    TRANSIENT_GROUP_ID,
    get_transient_group,
)
from ..io.filestore_crud import get_slice, delete_data_files
from .metadata import cast_tabular_cell_value_type
from .dataset_reference import add_id_mapping
import typing

log = logging.getLogger(__name__)

ROOT_ID = 1


def assert_user_has_access_to_dataset(dataset: Dataset, user: str):
    has_access = user_has_access_to_group(dataset.group, user)
    if not has_access:
        raise DatasetAccessError("User does not have access to dataset")


def get_dataset_filter_clauses(db, user):
    # Get groups for which the user has read-access
    groups = get_groups_with_visible_contents(db, user)  # TODO: update
    group_ids = [group.id for group in groups]

    filter_clauses = [Dataset.group_id.in_(group_ids)]  # pyright: ignore
    # Don't return transient datasets
    filter_clauses.append(Dataset.is_transient == False)

    return filter_clauses


def get_datasets(
    db: SessionWithUser,
    user: str,
    feature_id: Optional[str] = None,
    feature_type: Optional[str] = None,
    sample_id: Optional[str] = None,
    sample_type: Optional[str] = None,
    value_type: Optional[ValueType] = None,
) -> list[Dataset]:
    assert (
        db.user == user
    ), f"User parameter '{user}' must match the user set on the database session '{db.user}'"
    if feature_id is not None:
        if feature_type is None:
            raise UserError("If feature_id is specified, feature_type must be provided")

    if sample_id is not None:
        if sample_type is None:
            raise UserError("If sample_id is specified, sample_type must be provided")

    # Get all datasets that should be discoverable by the user
    groups = get_groups_with_visible_contents(db, user)
    group_ids = [group.id for group in groups]

    # Include columns for MatrixDataset, TabularDataset
    dataset_poly = with_polymorphic(Dataset, [MatrixDataset, TabularDataset])

    filter_clauses = [Dataset.group_id.in_(group_ids)]  # pyright: ignore
    # Don't return transient datasets
    filter_clauses.append(Dataset.is_transient == False)
    # TODO: Below filters only returns for matrix datasets!
    # Decide if should return for metadata when given feature id/type or sample id/type
    if feature_type is not None:
        filter_clauses.append(
            dataset_poly.MatrixDataset.feature_type_name == feature_type
        )

        if feature_id is not None:
            dataset_ids = [
                dataset_id
                for (dataset_id,) in db.query(DatasetFeature.dataset_id)
                .filter(DatasetFeature.given_id == feature_id)
                .all()
            ]
            filter_clauses.append(dataset_poly.MatrixDataset.id.in_(dataset_ids))

    if sample_type is not None:
        filter_clauses.append(
            dataset_poly.MatrixDataset.sample_type_name == sample_type
        )

        if sample_id is not None:
            dataset_ids = [
                dataset_id
                for (dataset_id,) in db.query(DatasetSample.dataset_id)
                .filter(and_(DatasetSample.given_id == sample_id,))
                .all()
            ]
            filter_clauses.append(dataset_poly.MatrixDataset.id.in_(dataset_ids))

    if value_type is not None:
        filter_clauses.append(dataset_poly.MatrixDataset.value_type == value_type)

    datasets = db.query(dataset_poly).filter(and_(True, *filter_clauses)).all()
    return datasets


def get_dataset(
    db: SessionWithUser, user: str, dataset_id: Union[str, UUID]
) -> Optional[Dataset]:
    assert (
        db.user == user
    ), f"User parameter '{user}' must match the user set on the database session '{db.user}'"
    dataset: Optional[Dataset] = db.query(Dataset).get(str(dataset_id))
    if dataset is None:
        return None

    if not user_has_access_to_group(dataset.group, user, write_access=False):
        return None

    return dataset


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
    feature_labels_and_aliases: pd.DataFrame,
    sample_labels_and_aliases: pd.DataFrame,
    feature_type: Optional[DimensionType],
    sample_type: DimensionType,
):
    group = _get_dataset_group(db, user, dataset_in.group_id, dataset_in.is_transient)

    allowed_values = dataset_in.allowed_values

    def is_binary_category(allowed_values_list):
        if allowed_values_list and len(allowed_values_list) == 2:
            allowed_values_set = set(allowed_values_list)
            return {"True", "False"} == allowed_values_set
        else:
            return False

    dataset = MatrixDataset(
        id=dataset_in.id,
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
    )
    db.add(dataset)
    db.flush()
    parent_node = db.query(CatalogNode).filter_by(id=ROOT_ID).one()
    dataset_catalog_node = CatalogNode(
        dataset=dataset,
        dimension_id=None,
        priority=0,
        parent_id=parent_node.id,
        label=dataset.name,
        is_continuous=True if dataset_in.value_type == ValueType.continuous else False,
        is_categorical=(
            True if dataset_in.value_type == ValueType.categorical else False
        ),
        is_binary=is_binary_category(allowed_values),
        is_text=False,
    )
    db.add(dataset_catalog_node)
    print(
        f"Added catalog node to {db} {db.bind}: node: {dataset_catalog_node.id} dataset: {dataset.id}"
    )
    db.flush()

    _add_matrix_dataset_dimensions(
        db=db,
        index_and_given_id=feature_labels_and_aliases,
        dimension_subtype_cls=DatasetFeature,
        dimension_type_name=feature_type.name if feature_type else None,
        dataset_catalog_node=dataset_catalog_node,
        dataset=dataset,
    )
    _add_matrix_dataset_dimensions(
        db=db,
        index_and_given_id=sample_labels_and_aliases,
        dimension_subtype_cls=DatasetSample,
        dimension_type_name=sample_type.name,
        dataset_catalog_node=dataset_catalog_node,
        dataset=dataset,
    )

    populate_search_index(db, user, dataset.id)
    db.flush()

    return dataset


@dataclass
class PropertyMetadata:
    value: str
    dimension_id: str
    annotation_type: AnnotationType


@dataclass
class DatasetDimensionMetadata:
    dimension_given_id: str
    axis: str
    type_name: str
    label: str
    property_metadata: Dict[str, PropertyMetadata]


@dataclass
class SearchIndexRecord:
    property: str
    value: str
    dimension_id: str


def get_metadata_by_dataset(
    db: SessionWithUser, dataset: Dataset, properties_to_index: List[str]
) -> Dict[str, DatasetDimensionMetadata]:

    assert (
        "label" in properties_to_index
    ), f"The code is assuming that label is present but dataset {dataset.id} had properties_to_index={properties_to_index}"

    feature_query = get_feature_query_for_feature_type(
        db=db,
        feature_type_dataset_id=dataset.id,
        properties_to_index=properties_to_index,
    )
    feature_df = pd.read_sql(
        feature_query.statement, feature_query.session.connection()
    )
    grouped_feature_df = feature_df.groupby("dimension_given_id")

    def format_property_metadata(group) -> Dict[str, PropertyMetadata]:
        property_metadata = {}
        for _, row in group.iterrows():
            if row["value"] is not None:
                property_metadata[row["given_id"]] = PropertyMetadata(
                    value=row["value"],
                    dimension_id=row["dimension_id"],
                    annotation_type=row["annotation_type"],
                )

        return property_metadata

    rows = {}
    for dimension_given_id, group in grouped_feature_df:
        rows[dimension_given_id] = DatasetDimensionMetadata(
            dimension_given_id=dimension_given_id,
            axis=group.head(1)["axis"].values[0],
            type_name=group.head(1)["dataset_dimension_type"].values[0],
            label=group["value"][group["given_id"] == "label"].values[0],
            property_metadata=format_property_metadata(group),
        )

    return rows


@dataclass
class CachedQueries:
    properties_to_index: List[str]
    rows: Dict[str, DatasetDimensionMetadata]
    dataset_column_ref: Dict[str, str]


def create_index_records_for_row(
    db,
    dataset: Dataset,
    user: str,
    user_supplied_id: str,
    row_cache: Dict[str, CachedQueries],
) -> List[SearchIndexRecord]:

    dimension_search_index_rows = []

    if dataset.id in row_cache:
        entry = row_cache[dataset.id]
        properties_to_index = entry.properties_to_index
        rows = entry.rows
        dataset_column_ref = entry.dataset_column_ref
    else:
        properties_to_index = get_properties_to_index(db, user, dataset.id)
        rows = get_metadata_by_dataset(
            db=db, dataset=dataset, properties_to_index=properties_to_index
        )
        dataset_column_ref = get_dataset_column_reference(
            db, user, dataset_id=dataset.id
        )

        row_cache[dataset.id] = CachedQueries(
            properties_to_index, rows, dataset_column_ref
        )

    row = rows.get(user_supplied_id)
    # if this ID is not specified, then just move on.
    if row is not None:
        for property in properties_to_index:
            # if this column is a fk, get the property/value pairs that we'd add to the index from the reference row
            if dataset_column_ref and property in dataset_column_ref:
                referenced_dataset_id = dataset_column_ref[property]
                referenced_dataset = (
                    db.query(Dataset).filter(Dataset.id == referenced_dataset_id).one()
                )

                if property not in row.property_metadata:
                    # if the property doesn't exist, just skip it instead of throwing an exception
                    # This often happens when updating datasets because the properties to index
                    # will include a property which hasn't been uploaded yet.
                    continue
                else:
                    if (
                        row.property_metadata[property].annotation_type
                        == AnnotationType.list_strings
                    ):
                        values = cast_tabular_cell_value_type(
                            row.property_metadata[property].value,
                            row.property_metadata[property].annotation_type,
                        )
                    else:
                        values = [row.property_metadata[property].value]

                assert isinstance(values, list)
                parent_dimension_id = row.property_metadata[property].dimension_id
                for user_supplied_id_val in values:
                    for search_index_record in create_index_records_for_row(
                        db,
                        dataset=referenced_dataset,
                        user=user,
                        user_supplied_id=user_supplied_id_val,
                        row_cache=row_cache,
                    ):
                        # prefix the property name before adding to the index with the name
                        # of the relationship that we traversed to get it. (this let's us
                        # distinguish those properties which have the same name. For example, for
                        # a compound, we'll get "alias" which is an alternative name for the
                        # compound and "target.alias" which is an alternative name for the gene targeted
                        # by the compound)
                        dimension_search_index_rows.append(
                            SearchIndexRecord(
                                property=f"{property}.{search_index_record.property}",
                                value=search_index_record.value,
                                dimension_id=parent_dimension_id,
                            )
                        )
            else:
                property_metadata = row.property_metadata
                if property in property_metadata:
                    value = property_metadata[property].value

                    if (
                        property_metadata[property].annotation_type
                        == AnnotationType.list_strings
                    ):
                        values = cast_tabular_cell_value_type(
                            value=value,
                            type=property_metadata[property].annotation_type,
                        )
                    else:
                        values = [value]

                    assert isinstance(values, list)

                    for value in values:
                        dimension_search_index_rows.append(
                            SearchIndexRecord(
                                property=property,
                                value=value,
                                dimension_id=property_metadata[property].dimension_id,
                            ),
                        )

    return dimension_search_index_rows


def get_feature_query_for_feature_type(
    db: SessionWithUser, feature_type_dataset_id: str, properties_to_index: List[str],
):
    filter_clauses = [
        DimensionType.dataset_id == feature_type_dataset_id,
        Dimension.given_id.in_(properties_to_index),
    ]

    feature_query = (
        db.query(TabularCell)
        .join(TabularColumn, TabularCell.tabular_column_id == TabularColumn.id,)
        .join(DimensionType, TabularColumn.dataset_id == DimensionType.dataset_id,)
        .filter(and_(True, *filter_clauses))
        .with_entities(
            TabularCell.dimension_given_id,
            TabularCell.value,
            TabularCell.tabular_column_id,
            TabularColumn.annotation_type,
            DimensionType.id_column,
            DimensionType.axis,
            Dimension.dataset_dimension_type,
            Dimension.given_id,
            Dimension.id.label("dimension_id"),
        )
    )

    return feature_query


def get_properties_to_index(
    db: SessionWithUser, user: str, dataset_id: str
) -> list[str]:
    dataset = get_dataset(db=db, user=user, dataset_id=dataset_id)
    if dataset is None:
        raise ResourceNotFoundError(f"Dataset '{dataset_id}' not found.")
    assert user_has_access_to_group(dataset.group, user)

    property_to_index_rows = (
        db.query(PropertyToIndex)
        .filter(PropertyToIndex.dataset_id == dataset_id)
        .with_entities(PropertyToIndex.property)
        .all()
    )

    return [property_name for property_name, in property_to_index_rows]


def get_dataset_column_reference(
    db: SessionWithUser, user: str, dataset_id: str
) -> dict[str, str]:
    dataset = get_dataset(db=db, user=user, dataset_id=dataset_id)
    if dataset is None:
        raise ResourceNotFoundError(f"Dataset '{dataset_id}' not found.")
    assert user_has_access_to_group(dataset.group, user)

    reference_columns = (
        db.query(DatasetReference)
        .filter(DatasetReference.dataset_id == dataset_id)
        .all()
    )

    return {
        ref_col.column: ref_col.referenced_dataset_id for ref_col in reference_columns
    }


def _get_impacted_dataset_ids(db, orig_dataset_id):
    seen_ids = []
    seen_ids.append(orig_dataset_id)

    def _get_dataset_ids(dataset_id):
        datasets_result = (
            db.query(DatasetReference)
            .filter(DatasetReference.dataset_id == dataset_id)
            .with_entities(
                DatasetReference.referenced_dataset_id, DatasetReference.dataset_id,
            )
            .all()
        )
        ref_datasets_result = (
            db.query(DatasetReference)
            .filter(DatasetReference.referenced_dataset_id == dataset_id)
            .with_entities(DatasetReference.referenced_dataset_id)
            .all()
        )

        datasets = [d for dr in datasets_result for d in dr]
        ref_datastet_ids = [r for r, in ref_datasets_result]
        all_dataset_ids = datasets + ref_datastet_ids

        for d_id in all_dataset_ids:
            if d_id not in seen_ids:
                seen_ids.append(d_id)
                _get_dataset_ids(d_id)

    _get_dataset_ids(orig_dataset_id)
    return seen_ids


def _populate_search_index_for_dataset(db: SessionWithUser, user: str, dataset_id: str):
    log.info("_populate_search_index_for_dataset %s", dataset_id)
    dataset = get_dataset(db=db, user=user, dataset_id=dataset_id)
    if not dataset or not user_has_access_to_group(
        dataset.group, user, write_access=True
    ):
        return None

    properties_to_index = get_properties_to_index(
        db=db, user=user, dataset_id=dataset_id
    )

    if not properties_to_index or len(properties_to_index) == 0:
        return None

    log.info("_delete_dataset_dimension_search_index_records start")
    _delete_dataset_dimension_search_index_records(db=db, dataset_id=dataset_id)
    log.info("_delete_dataset_dimension_search_index_records complete")

    labels_by_feature_id_query = (
        db.query(TabularCell)
        .join(TabularColumn, TabularCell.tabular_column_id == TabularColumn.id,)
        .join(DimensionType, TabularColumn.dataset_id == DimensionType.dataset_id,)
        .filter(
            and_(DimensionType.dataset_id == dataset_id, Dimension.given_id == "label")
        )
        .with_entities(TabularCell.dimension_given_id, TabularCell.value)
    )

    labels_by_dimension_given_id = dict(labels_by_feature_id_query)

    dimension_search_index_rows = []
    rows = get_metadata_by_dataset(
        db=db, dataset=dataset, properties_to_index=properties_to_index
    )
    row_cache = {}

    for row in rows.values():
        for record in create_index_records_for_row(
            db=db,
            dataset=dataset,
            user=user,
            user_supplied_id=row.dimension_given_id,
            row_cache=row_cache,
        ):
            if record:
                dimension_search_index_rows.append(
                    DimensionSearchIndex(
                        dimension_id=record.dimension_id,
                        dimension_given_id=row.dimension_given_id,
                        label=labels_by_dimension_given_id[
                            row.dimension_given_id
                        ],  # value where "dimension_given_id" == "label"
                        property=record.property,
                        priority=0,
                        axis=row.axis,  # "feature" vs. "sample"
                        value=record.value,
                        type_name=row.type_name,
                        group_id=dataset.group_id,
                    )
                )
    log.info("_populate_search_index_for_dataset complete")

    return dimension_search_index_rows


def populate_search_index(db: SessionWithUser, user: str, dataset_id: str):
    dataset = get_dataset(db=db, user=user, dataset_id=dataset_id)
    if not dataset or not user_has_access_to_group(
        dataset.group, user, write_access=True
    ):
        return False

    properties_to_index = get_properties_to_index(
        db=db, user=user, dataset_id=dataset_id
    )

    if not properties_to_index or len(properties_to_index) == 0:
        return False

    impacted_dataset_ids = _get_impacted_dataset_ids(db, dataset_id)

    dimension_search_index_rows = []
    for impacted_id in impacted_dataset_ids:
        rows = _populate_search_index_for_dataset(db, user, impacted_id)
        if rows and len(rows) > 0:
            dimension_search_index_rows.extend(rows)

    db.bulk_save_objects(dimension_search_index_rows)
    db.flush()


def _delete_dataset_dimension_search_index_records(
    db: SessionWithUser, dataset_id: str
):
    dimensions_to_delete = [
        id
        for id, in db.query(DimensionSearchIndex)
        .join(Dimension)
        .filter(Dimension.dataset_id == dataset_id)
        .with_entities(Dimension.id)
        .distinct()
    ]

    db.query(DimensionSearchIndex).filter(
        DimensionSearchIndex.dimension_id.in_(list(dimensions_to_delete))
    ).delete()

    db.flush()
    return True


def _add_matrix_dataset_dimensions(
    db: SessionWithUser,
    index_and_given_id: pd.DataFrame,
    dimension_subtype_cls: Union[Type[DatasetFeature], Type[DatasetSample]],
    dimension_type_name: Optional[str],
    dataset_catalog_node: CatalogNode,
    dataset: MatrixDataset,
):
    dimensions: List[Union[DatasetFeature, DatasetSample]] = []
    catalog_nodes: List[CatalogNode] = []

    index_and_given_id = dimension_label_df_schema.validate(index_and_given_id)

    for row in index_and_given_id.to_records(index=False):
        dimension_id = str(uuid4())
        given_id = str(row["given_id"])
        row_index = int(row["index"])

        assert dimension_subtype_cls in [DatasetFeature, DatasetSample]
        dimensions.append(
            dimension_subtype_cls(
                id=dimension_id,
                dataset_id=dataset.id,
                given_id=given_id,
                dataset_dimension_type=dimension_type_name,
                index=row_index,
                group_id=dataset.group_id,
            )
        )

        # `given_id` is being passed in here for the label of the catalog node. This is technically not how
        # catalog nodes were originally intended to work, but:
        #    1. we should be eliminating catalog nodes in the future
        #    2. catalog nodes no longer have any UI impact
        #    3. removing catalog nodes at this time would require a decent amount of refactoring
        # This allows us to keep catalog nodes until we're ready to remove them, while at the same time
        # avoiding catalog nodes depending on labels. (Metadata can now change after datasets are loaded,
        # so any labels run the risk of being out of date)
        dimension_catalog_nodes = _create_dataset_dimension_catalog_nodes(
            row, dimension_id, given_id, dataset_catalog_node,
        )
        catalog_nodes.extend(dimension_catalog_nodes)

    db.bulk_save_objects(dimensions)
    db.flush()
    add_catalog_nodes(db, catalog_nodes)
    db.flush()


def add_tabular_dataset(
    db: SessionWithUser,
    user: str,
    dataset_in: TabularDatasetIn,
    data_df: pd.DataFrame,
    columns_metadata: Dict[str, ColumnMetadata],
    dimension_type: DimensionType,
):
    # verify the id_column is present in the data frame before proceeding and is of type string
    if dimension_type.id_column not in data_df.columns:
        raise ValueError(
            f'The dimension type "{dimension_type.name}" uses "{dimension_type.id_column}" for the ID, however that column is not present in the table. The actual columns were: {data_df.columns.to_list()}'
        )

    group = _get_dataset_group(db, user, dataset_in.group_id, dataset_in.is_transient)
    dataset = TabularDataset(
        id=dataset_in.id,
        name=dataset_in.name,
        index_type_name=dataset_in.index_type_name,
        data_type=dataset_in.data_type,
        is_transient=dataset_in.is_transient,
        group_id=group.id,
        priority=dataset_in.priority,
        taiga_id=dataset_in.taiga_id,
        dataset_metadata=dataset_in.dataset_metadata,
        md5_hash=dataset_in.dataset_md5,
    )
    db.add(dataset)
    db.flush()

    reference_column_mappings = {
        name: metadata.references
        for name, metadata in columns_metadata.items()
        if metadata.references is not None
    }
    add_id_mapping(db, reference_column_mappings, dataset)

    _add_tabular_dimensions(
        db, data_df, columns_metadata, dataset.id, dimension_type, group_id=group.id
    )

    populate_search_index(db, user, dataset.id)
    db.flush()

    return dataset


def _add_tabular_dimensions(
    db: SessionWithUser,
    data_df: pd.DataFrame,
    columns_metadata: Dict[str, ColumnMetadata],
    dataset_id: str,
    dimension_type: DimensionType,
    group_id: str,
):
    """
    Adds tabular dataset dimensions to database. Note that unlike matrix datasets, we do not store catalog nodes for each dimension since catalog nodes are expected to be deprecated in the future.
    """
    dimensions = []
    values = []

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

    for col in data_df.columns:
        annotation_id = str(uuid4())
        dimensions.append(
            TabularColumn(
                id=annotation_id,
                dataset_id=dataset_id,
                given_id=col,
                dataset_dimension_type=dimension_type.name,
                annotation_type=columns_metadata[col].col_type,
                units=columns_metadata[col].units,
                group_id=group_id,
            )
        )
        values.extend(
            [
                TabularCell(
                    tabular_column_id=annotation_id,
                    dimension_given_id=index,
                    value=None
                    if pd.isnull(val)
                    else str(val),  # Val could be pd.NA. Store null as None
                    group_id=group_id,
                )
                for index, val in zip(data_df[dimension_type.id_column], data_df[col],)
            ]
        )

    db.bulk_save_objects(dimensions)
    db.flush()
    db.bulk_save_objects(values)
    db.flush()


def _find_datasets_referencing(
    db: SessionWithUser, dataset_filter_clause, dimension_type_name: str, given_id: str,
):
    with_feature = (
        db.query(DatasetFeature)
        .join(MatrixDataset)
        .filter(
            DatasetFeature.given_id == given_id,
            MatrixDataset.feature_type_name == dimension_type_name,
            *dataset_filter_clause,
        )
        .with_entities(MatrixDataset.id, MatrixDataset.name, MatrixDataset.group_id)
    )

    with_sample = (
        db.query(DatasetSample)
        .join(MatrixDataset)
        .filter(
            DatasetFeature.given_id == given_id,
            MatrixDataset.sample_type_name == dimension_type_name,
            *dataset_filter_clause,
        )
        .with_entities(MatrixDataset.id, MatrixDataset.name, MatrixDataset.group_id)
    )

    query = with_feature.union(with_sample).order_by(MatrixDataset.name)

    #
    # def has_access_to_group(group_id):
    #     # this would likely be much more efficient if it was lifted into the query above,
    #     # however, I'm not confident that the check can be efficiently implemented in SQL.
    #     # I'll use the existing method we'll see how bad performance is. Might not be so
    #     # bad because we have relatively few groups and sqlalchemy should cache the objects
    #     group = db.get(Group, group_id)
    #     return user_has_access_to_group(group, user)
    from breadbox.schemas.dataset import NameAndID

    datasets = [
        NameAndID(name=name, id=id) for id, name, dataset_group_id in query.all()
    ]
    return datasets


def get_dataset_dimension_search_index_entries(
    db: SessionWithUser,
    user: str,
    limit: int,
    prefix: Optional[str],
    substrings: List[str],
    dimension_type_name: Optional[str],
    include_referenced_by: bool,
):
    # Filter out any datasets the user doesn't have access to
    visible_database_clause = get_dataset_filter_clauses(db, user)

    search_index_filter_clauses = []
    outer = aliased(DimensionSearchIndex)

    if prefix is not None:
        search_index_filter_clauses.append(
            outer.value.startswith(prefix, autoescape=True)
        )

    if dimension_type_name:
        search_index_filter_clauses.append(outer.type_name == dimension_type_name)

    if len(substrings) > 0:
        predicate_per_substring = [
            db.query(DimensionSearchIndex)
            .join(Dimension)
            .filter(
                and_(
                    DimensionSearchIndex.value.contains(substring, autoescape=True),
                    *search_index_filter_clauses,
                    outer.type_name == DimensionSearchIndex.type_name,
                    outer.dimension_given_id == DimensionSearchIndex.dimension_given_id,
                )
            )
            .with_entities(
                DimensionSearchIndex.type_name, DimensionSearchIndex.dimension_given_id,
            )
            .exists()
            for substring in substrings
        ]

        property_matches_at_least_one_substring = or_(
            *[
                outer.value.contains(substring, autoescape=True)
                for substring in substrings
            ]
        )

        search_index_query = (
            db.query(outer)
            .join(Dimension)
            .filter(
                and_(property_matches_at_least_one_substring, *predicate_per_substring)
            )
            .order_by(outer.priority, outer.label)
            .limit(limit)
            .with_entities(
                outer.type_name,
                outer.dimension_given_id,
                outer.label,
                outer.property,
                outer.value,
            )
        )

    else:
        search_index_query = (
            db.query(outer)
            .join(Dimension)
            .filter(and_(True, *search_index_filter_clauses))
            .order_by(outer.priority, outer.label)
            .limit(limit)
            .with_entities(
                outer.type_name,
                outer.dimension_given_id,
                outer.label,
                outer.property,
                outer.value,
            )
        )

    search_index_entries = pd.read_sql(
        search_index_query.statement, search_index_query.session.connection()
    )

    grouped_search_index_entries = search_index_entries.groupby(
        ["dimension_given_id", "type_name"],
        sort=False,  # set sort=False to preserve the ordering from the original search_index_query
    )

    group_entries: List[DimensionSearchIndexResponse] = []
    for id_type_name_tuple, group in grouped_search_index_entries:
        dimension_given_id, type_name = typing.cast(typing.Tuple, id_type_name_tuple)

        if include_referenced_by:
            referenced_by = _find_datasets_referencing(
                db, visible_database_clause, type_name, dimension_given_id
            )
        else:
            referenced_by = None

        group_entries.append(
            DimensionSearchIndexResponse(
                type_name=type_name,
                label=group["label"].values[0],
                id=dimension_given_id,
                referenced_by=referenced_by,
                matching_properties=[
                    {"property": row["property"], "value": row["value"],}
                    for _, row in group.iterrows()
                    if row["value"] is not None
                ],
            )
        )

    return group_entries


def get_dataset_feature_dimensions(db: SessionWithUser, user: str, dataset_id: str):
    dataset = get_dataset(db, user, dataset_id)

    assert_user_has_access_to_dataset(dataset, user)

    dimensions = (
        db.query(Dimension)
        .filter(
            and_(Dimension.dataset_id == dataset_id, DimensionType.axis == "feature")
        )
        .order_by(Dimension.id)
        .all()
    )

    return dimensions


def get_dataset_features(db: SessionWithUser, dataset: Dataset, user: str):
    assert_user_has_access_to_dataset(dataset, user)

    dataset_features = (
        db.query(DatasetFeature)
        .filter(DatasetFeature.dataset_id == dataset.id)
        .order_by(DatasetFeature.given_id)
        .all()
    )

    return dataset_features


def get_dataset_samples(db: SessionWithUser, dataset: Dataset, user: str):
    assert_user_has_access_to_dataset(dataset, user)

    dataset_samples = (
        db.query(DatasetSample)
        .filter(DatasetSample.dataset_id == dataset.id)
        .order_by(DatasetSample.given_id)
        .all()
    )

    return dataset_samples


def get_dataset_feature_labels_by_id(
    db: SessionWithUser, user: str, dataset: Dataset,
) -> dict[str, str]:
    """
    Try loading feature labels from metadata.
    If there are no labels in the metadata or there is no metadata, then just return the feature names.
    """
    metadata_labels_by_given_id = get_dataset_feature_annotations(
        db=db, user=user, dataset=dataset, metadata_col_name="label"
    )

    if metadata_labels_by_given_id:
        return metadata_labels_by_given_id
    else:
        all_dataset_features = get_dataset_features(db=db, dataset=dataset, user=user)
        return {feature.given_id: feature.given_id for feature in all_dataset_features}


def get_dataset_sample_labels_by_id(
    db: SessionWithUser, user: str, dataset: Dataset,
) -> dict[str, str]:
    """
    Try loading sample labels from metadata.
    If there are no labels in the metadata or there is no metadata, then just return the sample names.
    """
    metadata_labels = get_dataset_sample_annotations(
        db=db, user=user, dataset=dataset, metadata_col_name="label"
    )
    if metadata_labels:
        return metadata_labels
    else:
        samples = get_dataset_samples(db=db, dataset=dataset, user=user)
        return {sample.given_id: sample.given_id for sample in samples}


from typing import Any


# TODO: This can probably be merged.
def get_dataset_feature_annotations(
    db: SessionWithUser, user: str, dataset: Dataset, metadata_col_name: str,
) -> dict[str, Any]:
    """
    For the given dataset, load metadata of the specified type, keyed by feature id.
    For example, if a dataset's feature type is "gene", and the requested metadata field name is "label",
    then this will return a dictionary with entrez ids as keys and gene labels as values.
    If there is no metadata of this type, return an empty dictionary.
    Note: this may need to be updated eventually to support non-string types in metadata
    """
    assert_user_has_access_to_dataset(dataset, user)

    # Try to find the associated metadata dataset
    feature_metadata_dataset_id = None
    if dataset.format == "matrix_dataset":
        if dataset.feature_type is not None:
            feature_type = (
                db.query(DimensionType)
                .filter(DimensionType.name == dataset.feature_type_name)
                .one()
            )
            feature_metadata_dataset_id = feature_type.dataset_id
    else:
        feature_metadata_dataset_id = dataset.id

    data_dataset_feature = aliased(DatasetFeature)

    # Load the values and entity ids
    annotation_vals_by_id: Dict[str, Any] = {
        row[0]: cast_tabular_cell_value_type(row[1], row[2])
        for row in db.query(TabularCell)
        .join(
            data_dataset_feature,
            data_dataset_feature.given_id == TabularCell.dimension_given_id,
        )  # join the given dataset's dimensions
        .filter_by(dataset_id=dataset.id)
        .join(TabularCell.tabular_column)  # join the metadata dimension
        .filter_by(dataset_id=feature_metadata_dataset_id, given_id=metadata_col_name,)
        .with_entities(
            TabularCell.dimension_given_id,
            TabularCell.value,
            TabularColumn.annotation_type,
        )
    }

    return annotation_vals_by_id


def get_dataset_sample_annotations(
    db: SessionWithUser, user: str, dataset: Dataset, metadata_col_name: str
) -> dict[str, Any]:
    """
    For the given dataset, load metadata of the specified type, keyed by sample id.
    For example, if a dataset's sample type is "depmap_model", and the requested metadata field name is "label",
    then this will return a dictionary with depmap ids as keys and cell line names as values.
    If there is no metadata of this type, return an empty dictionary.
    Note: this may need to be updated eventually to support non-string types in metadata
    """
    assert_user_has_access_to_dataset(dataset, user)

    # Try to find the associated metadata dataset
    sample_metadata_dataset_id = None
    if dataset.format == "matrix_dataset":
        if dataset.sample_type is not None:
            sample_type = (
                db.query(DimensionType)
                .filter(DimensionType.name == dataset.sample_type_name)
                .one()
            )
            sample_metadata_dataset_id = sample_type.dataset_id
    else:
        sample_metadata_dataset_id = dataset.id

    data_dataset_sample = aliased(DatasetSample)

    # Load the labels and entity ids
    annotation_vals_by_id = {
        row[0]: cast_tabular_cell_value_type(row[1], row[2])
        for row in db.query(TabularCell)
        .join(
            data_dataset_sample,
            data_dataset_sample.given_id == TabularCell.dimension_given_id,
        )
        .filter_by(dataset_id=dataset.id)
        .join(TabularCell.tabular_column)
        .filter_by(dataset_id=sample_metadata_dataset_id, given_id=metadata_col_name,)
        .with_entities(
            TabularCell.dimension_given_id,
            TabularCell.value,
            TabularColumn.annotation_type,
        )
    }
    return annotation_vals_by_id


def get_matching_feature_metadata_labels(
    db: SessionWithUser, feature_labels: List[str]
) -> set[str]:
    """
    Return the subset of the given list which matches any feature metadata label
    Use case-insensitive matching, but return a list of properly-cased labels.
    """
    lowercase_input_labels = [label.lower() for label in feature_labels]

    # Get all matching labels that exist in feature metadata
    matching_label_results = (
        db.query(DimensionType)
        .join(TabularDataset, DimensionType.dataset)
        .join(TabularColumn, TabularDataset.dimensions)
        .join(TabularCell, TabularColumn.tabular_cells)
        .filter(
            DimensionType.axis == "feature",
            TabularColumn.given_id == "label",
            func.lower(TabularCell.value).in_(lowercase_input_labels),
        )
        .with_entities(TabularCell.value)
        .all()
    )

    return {label for (label,) in matching_label_results}


def _get_indexes_by_given_id(
    db: SessionWithUser,
    user: str,
    dataset: Dataset,
    axis: Union[DatasetFeature, DatasetSample],
    given_ids: List[str],
) -> Tuple[List[int], List[str]]:
    assert_user_has_access_to_dataset(dataset, user)

    unique_given_ids = set(given_ids)
    assert len(given_ids) == len(unique_given_ids), "Duplicate IDs present"

    results = (
        db.query(axis)
        .filter(
            and_(
                axis.dataset_id == dataset.id,
                axis.given_id.in_(given_ids),  # pyright: ignore
            )
        )
        .with_entities(axis.given_id, axis.index)
        .order_by(axis.index)
        .all()
    )

    given_id_to_index = dict(results)

    return (
        list(given_id_to_index.values()),
        list(unique_given_ids.difference(given_id_to_index.keys())),
    )


def get_feature_indexes_by_given_ids(
    db: SessionWithUser, user: str, dataset: Dataset, given_ids: List[str]
):
    return _get_indexes_by_given_id(db, user, dataset, DatasetFeature, given_ids)


def get_dimension_indexes_of_labels(
    db: SessionWithUser,
    user: str,
    dataset: MatrixDataset,
    axis: str,
    dimension_labels: List[str],
) -> Tuple[List[int], List[str]]:
    """
    Get the set of numeric indices corresponding to the given dimension labels for the given dataset.
    Note: The order of the result does not necessarily match the order of the input
    """
    assert_user_has_access_to_dataset(dataset, user)

    # We could do this in one query, but it's unwieldy, so let's make two queries. First
    # let's resolve dimension_labels to given_ids

    def _query_given_id_and_label(type_name):
        results = (
            db.query(DimensionType)
            .join(TabularDataset, DimensionType.dataset)
            .join(TabularColumn, TabularDataset.dimensions)
            .join(TabularCell, TabularColumn.tabular_cells)
            .filter(
                TabularColumn.given_id == "label",
                DimensionType.name == type_name,
                TabularCell.value.in_(dimension_labels),
            )
            .with_entities(TabularCell.dimension_given_id, TabularCell.value)
            .all()
        )
        return results

    if axis == "feature":
        if dataset.feature_type_name is None:
            # feature types are allowed to be None. If that's the case, the labels are the given_ids on the matrix
            given_id_and_label = (
                db.query(DatasetFeature)
                .filter(
                    DatasetFeature.dataset_id == dataset.id,
                    DatasetFeature.given_id.in_(dimension_labels),
                )
                .with_entities(DatasetFeature.given_id, DatasetFeature.given_id)
            )
        else:
            given_id_and_label = _query_given_id_and_label(dataset.feature_type_name)
    else:
        assert axis == "sample"
        given_id_and_label = _query_given_id_and_label(dataset.sample_type_name)

    # unpack into two columns
    given_id_to_label = dict(given_id_and_label)

    missing_labels = set(dimension_labels).difference(given_id_to_label.values())

    # for the time being, just warn in the log about things that are missing. I'm not 100% confident that
    # something won't break if we start treating missing things as an error. If we don't see warnings in the
    # log from normal use, we can turn it into an error later
    if len(missing_labels) > 0:
        log.warning(
            f"In get_dimension_indexes_of_labels, missing labels: {missing_labels}"
        )

    # now resolve those given_ids to indices
    if axis == "feature":
        indices, missing_given_ids = get_feature_indexes_by_given_ids(
            db, user, dataset, list(given_id_to_label.keys())
        )
    else:
        assert axis == "sample"
        indices, missing_given_ids = get_sample_indexes_by_given_ids(
            db, user, dataset, list(given_id_to_label.keys())
        )

    if len(missing_given_ids) > 0:
        log.warning(
            f"In get_dimension_indexes_of_labels, missing given_ids: {missing_given_ids}"
        )

    return indices, list(missing_labels)


def get_dataset_feature_by_uuid(
    db: SessionWithUser, user: str, dataset: Dataset, feature_uuid: str
) -> DatasetFeature:
    warnings.warn(
        "get_dataset_feature_by_uuid is deprecated and should only be used by legacy Elara functionality."
    )
    assert_user_has_access_to_dataset(dataset, user)

    feature = (
        db.query(DatasetFeature).filter(DatasetFeature.id == feature_uuid).one_or_none()
    )
    if feature is None:
        raise ResourceNotFoundError(
            f"Feature id '{feature_uuid}' not found in dataset '{dataset.id}' features."
        )
    assert feature.dataset_id == dataset.id

    return feature


def get_all_sample_indexes(
    db: SessionWithUser, user: str, dataset: Dataset
) -> List[int]:
    assert_user_has_access_to_dataset(dataset, user)

    return [
        index
        for (index,) in db.query(DatasetSample.index)
        .filter(DatasetSample.dataset_id == dataset.id)
        .order_by(DatasetSample.index)
        .all()
    ]


def get_sample_indexes_by_given_ids(
    db: SessionWithUser, user: str, dataset: Dataset, given_ids: List[str]
):
    return _get_indexes_by_given_id(db, user, dataset, DatasetSample, given_ids)


def get_dataset_data_type_priorities(db: SessionWithUser):
    data_type_tuples = (
        db.query(Dataset)
        .order_by(Dataset.data_type)
        .with_entities(Dataset.data_type, Dataset.priority)
        .all()
    )

    priorities_by_data_type = defaultdict(list)
    for data_type, priority in data_type_tuples:
        if priority:
            priorities_by_data_type[data_type].append(priority)
        else:
            priorities_by_data_type[data_type] = []

    return priorities_by_data_type


def update_dataset(
    db: SessionWithUser, user: str, dataset: Dataset, new_values: DatasetUpdateParams
):
    new_group = get_group(db, user, new_values.group_id, write_access=False)
    if new_group is None:
        raise ResourceNotFoundError(f"Group not found: {new_values.group_id}")

    if not user_has_access_to_group(dataset.group, user, write_access=True):
        raise DatasetAccessError(f"User {user} cannot access this dataset!")
    if not user_has_access_to_group(new_group, user, write_access=True):
        raise DatasetAccessError("User {user} cannot access this dataset!")

    dataset.group = new_group

    if new_values.dataset_metadata:
        dataset.dataset_metadata = new_values.dataset_metadata

    if new_values.name:
        dataset.name = new_values.name

    if new_values.units:
        dataset.units = new_values.units

    if new_values.data_type:
        dataset.data_type = new_values.data_type

    dataset.priority = new_values.priority

    db.flush()
    return dataset


def delete_dataset(
    db: SessionWithUser, user: str, dataset: Dataset, filestore_location: str
):
    if not user_has_access_to_group(dataset.group, user, write_access=True):
        return False

    log.info("delete Dimension")
    db.query(Dimension).filter(Dimension.dataset_id == dataset.id).delete()
    log.info("delete_dataset %s delete dataset itself", dataset.id)
    db.delete(dataset)

    log.info("delete CatalogNode %s", dataset.id)
    # NOTE: Manually delete dataset's CatalogNodes instead of relying foreign key
    # constraints and cascade deletes because the self-referencing relationship is causing
    # large performance issues. Notice how there are no foreign key constraints only for
    # catalog_node in models
    db.query(CatalogNode).filter(CatalogNode.dataset_id == dataset.id).delete()
    # NOTE: Delete dataset should perform cascade deletes for the rest of the related tables

    # Matrix dataset files are stored as hdf5 and need to be deleted as well
    if dataset.format == "matrix_dataset":
        delete_data_files(dataset.id, filestore_location)

    log.info("delete_dataset %s complete", dataset.id)
    return True


def _create_dataset_dimension_catalog_nodes(
    dimension_row: pd.Series,
    dimension_id: str,
    dimension_label: str,
    dataset_catalog_node: CatalogNode,
) -> List[CatalogNode]:
    catalog_nodes: List[CatalogNode] = []

    aliases_set = set()
    aliases_set.add(dimension_label)

    for alias in aliases_set:
        catalog_nodes.append(
            CatalogNode(
                dataset_id=dataset_catalog_node.dataset_id,
                dimension_id=dimension_id,
                priority=0,
                parent=dataset_catalog_node,
                label=alias,
                is_continuous=dataset_catalog_node.is_continuous,
                is_categorical=dataset_catalog_node.is_categorical,
                is_binary=dataset_catalog_node.is_binary,
                is_text=dataset_catalog_node.is_text,
            )
        )
    return catalog_nodes


def add_catalog_nodes(db: SessionWithUser, catalog_nodes: List[CatalogNode]):
    for i in range(0, len(catalog_nodes), 10000):  # arbitrary chunk size
        chunk = i + 10000
        db.bulk_save_objects(catalog_nodes[i:chunk])


def get_catalog_node(
    db: SessionWithUser, user: str, id: int,
):
    node = db.query(CatalogNode).get(id)

    if node is None:
        return None

    if node.dataset_id:
        dataset = get_dataset(db, user, node.dataset_id)
        if dataset is None:
            return None
    if node.parent and node.parent.dataset_id:
        dataset = get_dataset(db, user, node.parent.dataset_id)
        if dataset is None:
            return None
    return node


def get_features(
    db: SessionWithUser, user: str, dataset_ids: List[str], feature_ids: List[str]
) -> list[DatasetFeature]:
    """
    Load data for a set of features with the given natural keys (ex. entrez ids)
    """
    # iterate through the dataset id, feature id pairs
    features = []
    assert len(dataset_ids) == len(feature_ids)

    for i in range(len(dataset_ids)):
        feature = (
            db.query(DatasetFeature)
            .filter(
                DatasetFeature.given_id == feature_ids[i],
                DatasetFeature.dataset_id == dataset_ids[i],
            )
            .one_or_none()
        )
        features.append(feature)

    # validate that all of the requested features were loaded
    if None in features:
        raise ResourceNotFoundError(msg="One or more features were not found")

    # validate access
    [assert_user_has_access_to_dataset(feature.dataset, user) for feature in features]
    return features


def get_dataset_feature(
    db: SessionWithUser, user: str, dataset_id: str, feature_label: str
) -> DatasetFeature:
    """Load the dataset feature corresponding to the given dataset ID and feature label"""

    dataset = get_dataset(db, user, dataset_id)
    if dataset is None:
        raise ResourceNotFoundError(f"Dataset '{dataset_id}' not found.")
    assert_user_has_access_to_dataset(dataset, user)
    assert isinstance(dataset, MatrixDataset)

    # check for metadata table associated with the features
    feature_metadata_dataset_id = None
    if dataset.feature_type is not None:
        feature_metadata_dataset_id = dataset.feature_type.dataset_id

    if feature_metadata_dataset_id is not None:
        # look up the given_id from the metadata
        assert feature_metadata_dataset_id
        result = (
            db.query(TabularColumn)
            .join(TabularCell)
            .filter(
                TabularColumn.dataset_id == feature_metadata_dataset_id,
                TabularColumn.given_id == "label",
                TabularCell.value == feature_label,
            )
            .with_entities(TabularCell.dimension_given_id)
            .one_or_none()
        )
        if result is None:
            raise ResourceNotFoundError(
                f"Feature label '{feature_label}' not found in dataset '{dataset_id}' feature metadata."
            )
        given_id = result["dimension_given_id"]
    else:
        # if there is no metadata, then the given_id is used as the label
        given_id = feature_label

    dataset_feature: Optional[DatasetFeature] = (
        db.query(DatasetFeature)
        .filter(
            and_(
                DatasetFeature.dataset_id == dataset_id,
                DatasetFeature.given_id == given_id,
            )
        )
        .one_or_none()
    )
    if dataset_feature is None:
        raise ResourceNotFoundError(
            f"Feature given_id '{given_id}' associated with label '{feature_label}' not found in dataset '{dataset_id}' features."
        )

    return dataset_feature


def get_subsetted_tabular_dataset_df(
    db: SessionWithUser,
    user: str,
    dataset: Dataset,
    tabular_dimensions_info: TabularDimensionsInfo,
    strict: bool,
):
    """
    Load a dataframe containing data for the specified indices and columns.
    If the indices are specified by label, then return a result indexed by labels
    If either indices or columns are not specified, return all indices or columns
    By default, if indices and identifier not specified, then dimension ids are used as identifier
    """
    if not user_has_access_to_group(dataset.group, user, write_access=True):
        raise DatasetAccessError(f"User {user} does not have access to dataset")

    filter_statements = [TabularColumn.dataset_id == dataset.id]
    # Filter columns if provided
    if tabular_dimensions_info.columns:
        filter_statements.append(
            TabularColumn.given_id.in_(tabular_dimensions_info.columns)
        )

    if tabular_dimensions_info.identifier == FeatureSampleIdentifier.label:
        # Get the corresponding dimension ids for the dimension labels and use the dimension ids to filter values by
        label_filter_statements = [
            TabularColumn.dataset_id == dataset.id,
            TabularColumn.given_id == "label",
        ]
        if tabular_dimensions_info.indices:
            label_filter_statements.append(
                TabularCell.value.in_(tabular_dimensions_info.indices)
            )
        ids_by_label = (
            db.query(TabularCell)
            .join(TabularColumn)
            .filter(and_(True, *label_filter_statements))
            .with_entities(TabularCell.value, TabularCell.dimension_given_id)
            .all()
        )
        id_to_label_map = dict((x.dimension_given_id, x.value) for x in ids_by_label)
        filter_statements.append(
            TabularCell.dimension_given_id.in_(id_to_label_map.keys())
        )
        query = (
            db.query(TabularColumn)
            .join(TabularCell)
            .filter(and_(True, *filter_statements))
            .with_entities(
                TabularCell.value,
                TabularCell.dimension_given_id,
                TabularColumn.given_id,
            )
        )

        query_df = pd.read_sql(query.statement, query.session.connection())
        # Rename the resulting column with dimension ids to their labels
        query_df = query_df.replace({"dimension_given_id": id_to_label_map})

    else:
        if tabular_dimensions_info.indices:
            filter_statements.append(
                TabularCell.dimension_given_id.in_(tabular_dimensions_info.indices)
            )

        query = (
            db.query(TabularColumn)
            .join(TabularCell)
            .filter(and_(True, *filter_statements))
            .with_entities(
                TabularCell.value,
                TabularCell.dimension_given_id,
                TabularColumn.given_id,
            )
        )

        query_df = pd.read_sql(query.statement, query.session.connection())

    # Pivot table so that the indices are the index of the df and the given columns are the columns of the df
    # NOTE: resulting df will have columns as multi index ("value", "given_id") so will need to index df by "value" to get final df
    pivot_df = query_df.pivot(index="dimension_given_id", columns="given_id")

    # If 'strict' raise error
    missing_columns, missing_indices = get_missing_tabular_columns_and_indices(
        pivot_df,
        tabular_dimensions_info.columns,
        tabular_dimensions_info.indices,
        dataset.id,
    )
    if strict:
        raise UserError(msg=get_truncated_message(missing_columns, missing_indices))

    # If df is empty, there is no 'value' key to index by
    if pivot_df.empty:
        return pivot_df

    # Need to index by "value" after checking if empty db bc empty db has no 'value' keyword
    subsetted_tabular_dataset_df = pivot_df["value"]
    # TODO: It seems like None data values are potentially stored as 'nan' in the db. Must fix this!
    subsetted_tabular_dataset_df = subsetted_tabular_dataset_df.replace({np.nan: None})
    return subsetted_tabular_dataset_df


def get_truncated_message(missing_tabular_columns, missing_tabular_indices):
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


def get_missing_tabular_columns_and_indices(
    df, tabular_columns, tabular_indices, dataset_id
):
    missing_columns = set()
    missing_indices = set()
    if tabular_columns is not None:
        found_columns = [x[1] for x in df.columns]
        missing_columns = set(tabular_columns).difference(found_columns)
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


def get_subsetted_matrix_dataset_df(
    db: SessionWithUser,
    user: str,
    dataset: Dataset,
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
        feature_indexes, missing_features = get_feature_indexes_by_given_ids(
            db, user, dataset, dimensions_info.features
        )
    else:
        assert dimensions_info.feature_identifier.value == "label"
        feature_indexes, missing_features = get_dimension_indexes_of_labels(
            db, user, dataset, axis="feature", dimension_labels=dimensions_info.features
        )

    if len(missing_features) > 0:
        log.warning(f"Could not find features: {missing_features}")

    if dimensions_info.samples is None:
        sample_indexes = None
    elif dimensions_info.sample_identifier.value == "id":
        sample_indexes, missing_samples = get_sample_indexes_by_given_ids(
            db, user, dataset, dimensions_info.samples
        )
    else:
        sample_indexes, missing_samples = get_dimension_indexes_of_labels(
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
        labels_by_id = get_dataset_feature_labels_by_id(db, user, dataset)
        df = df.rename(columns=labels_by_id)

    if dimensions_info.sample_identifier == FeatureSampleIdentifier.label:
        label_by_id = get_dataset_sample_labels_by_id(db, user, dataset)
        df = df.rename(index=label_by_id)

    return df


def get_feature_catalog_node(
    db: SessionWithUser, user: str, dataset_id: str, feature_label: str
) -> CatalogNode:
    """Load the catalog node corresponding to the given dataset ID and feature label"""
    node: CatalogNode = (
        db.query(CatalogNode)
        .join(DatasetFeature, DatasetFeature.id == CatalogNode.dimension_id)
        .filter(
            and_(
                CatalogNode.dataset_id == dataset_id,
                CatalogNode.dimension_id.isnot(None),
                CatalogNode.label == feature_label,
            )
        )
        .one()
    )
    assert_user_has_access_to_dataset(node.dataset, user)
    return node
