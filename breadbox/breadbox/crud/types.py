from typing import Any, Dict, List, Literal, Optional, Type, Union
from uuid import uuid4

from sqlalchemy import and_

import pandas as pd
import numpy as np

from breadbox.db.session import SessionWithUser
from breadbox.config import Settings
from breadbox.crud.access_control import PUBLIC_GROUP_ID
from breadbox.crud.dataset import (
    ROOT_ID,
    add_catalog_nodes,
    _create_dataset_dimension_catalog_nodes,
    delete_dataset,
    get_properties_to_index,
    populate_search_index,
)
from breadbox.crud.dataset_reference import add_id_mapping
from breadbox.io.data_validation import validate_all_columns_have_types
from breadbox.schemas.custom_http_exception import UserError
from breadbox.schemas.dataset import TabularDatasetIn
from breadbox.models.dataset import (
    AnnotationType,
    TabularCell,
    TabularColumn,
    CatalogNode,
    TabularDataset,
    DatasetSample,
    DatasetFeature,
    DimensionType,
    PropertyToIndex,
)


def _set_properties_to_index(
    db: SessionWithUser, properties_to_index: List[str], dataset_id: str, group_id: str,
):
    property_to_index_rows = []

    db.query(PropertyToIndex).filter_by(dataset_id=dataset_id).delete()
    db.flush()

    for property in properties_to_index:
        property_to_index_rows.append(
            PropertyToIndex(dataset_id=dataset_id, property=property, group_id=group_id)
        )

    if len(property_to_index_rows) > 0:
        db.bulk_save_objects(property_to_index_rows)
        db.flush()


def _add_annotation_dimensions(
    db: SessionWithUser,
    annotations_df: pd.DataFrame,
    annotation_type_mapping: Dict[str, AnnotationType],
    dataset_dimension_type_name: str,
    id_column: str,
    dataset_catalog_node: CatalogNode,
    dataset: TabularDataset,
    units_per_column: Dict[str, str],
):
    col_annotations: List[TabularColumn] = []
    catalog_nodes: List[CatalogNode] = []
    col_annotation_ids: Dict = {}
    annotation_values: List[TabularCell] = []

    for col in annotations_df.columns:
        annotation_id = str(uuid4())
        annotation_type = annotation_type_mapping[col]
        units = None
        if annotation_type == AnnotationType.continuous:
            units = units_per_column.get(col)
            assert (
                units is not None
            ), f"column {col} is continuous but were are missing units for that column"
        col_annotations.append(
            TabularColumn(
                id=annotation_id,
                dataset_id=dataset.id,
                given_id=col,
                dataset_dimension_type=dataset_dimension_type_name,
                annotation_type=annotation_type,
                units=units,
                group_id=dataset.group_id,
            )
        )
        annotation_values.extend(
            [
                TabularCell(
                    tabular_column_id=annotation_id,
                    dimension_given_id=index,
                    value=str(val) if val is not None else val,
                    group_id=dataset.group_id,
                )
                for index, val in zip(annotations_df[id_column], annotations_df[col],)
            ]
        )

        col_annotation_ids[col] = annotation_id
        catalog_nodes.append(
            CatalogNode(
                dataset_id=dataset.id,
                dimension_id=annotation_id,
                priority=0,
                parent=dataset_catalog_node,
                label=col,
                is_continuous=(
                    True
                    if annotation_type_mapping[col] == AnnotationType.continuous
                    else False
                ),
                is_categorical=(
                    True
                    if annotation_type_mapping[col] == AnnotationType.categorical
                    else False
                ),
                is_binary=(
                    True
                    if annotation_type_mapping[col] == AnnotationType.binary
                    else False
                ),
                is_text=(
                    True
                    if annotation_type_mapping[col] == AnnotationType.text
                    else False
                ),
            )
        )

    db.bulk_save_objects(col_annotations)
    db.flush()
    db.bulk_save_objects(catalog_nodes)
    db.flush()
    db.bulk_save_objects(annotation_values)
    db.flush()


def _add_metadata(
    db: SessionWithUser,
    metadata_df: pd.DataFrame,
    annotation_type_mapping: Dict[str, AnnotationType],
    dataset_dimension_type_name: str,
    id_column: str,
    dataset: TabularDataset,
    units_per_column: Dict[str, str],
):
    parent_node = db.query(CatalogNode).filter_by(id=ROOT_ID).one()
    annotation_mapping_values = set(annotation_type_mapping.values())
    dataset_catalog_node = CatalogNode(
        dataset=dataset,
        dimension_id=None,
        priority=0,
        parent_id=parent_node.id,
        label=dataset.name,
        is_continuous=AnnotationType.continuous in annotation_mapping_values,
        is_categorical=AnnotationType.categorical in annotation_mapping_values,
        is_binary=AnnotationType.binary in annotation_mapping_values,
        is_text=AnnotationType.text in annotation_mapping_values,
    )
    db.add(dataset_catalog_node)
    db.flush()
    _add_annotation_dimensions(
        db=db,
        annotations_df=metadata_df,
        annotation_type_mapping=annotation_type_mapping,
        dataset_dimension_type_name=dataset_dimension_type_name,
        id_column=id_column,
        dataset_catalog_node=dataset_catalog_node,
        dataset=dataset,
        units_per_column=units_per_column,
    )


def _add_dimension_type(
    db: SessionWithUser,
    user: str,
    name: str,
    id_column: str,
    axis: Literal["feature", "sample"],
    dataset_in: Optional[TabularDatasetIn] = None,
    metadata_df: Optional[pd.DataFrame] = None,
    annotation_type_mapping: Dict[str, AnnotationType] = None,
    reference_column_mappings: Optional[Dict[str, str]] = None,
    properties_to_index: Optional[List[str]] = None,
    units_per_column: Optional[Dict[str, str]] = None,
):
    if annotation_type_mapping is None:
        annotation_type_mapping = {}

    if reference_column_mappings is None:
        reference_column_mappings = {}

    if properties_to_index is None:
        properties_to_index = []

    if units_per_column is None:
        units_per_column = {}

    dataset_id = None
    dimension_type = DimensionType(
        name=name, axis=axis, dataset_id=dataset_id, id_column=id_column,
    )
    db.add(dimension_type)
    db.flush()

    if dataset_in is not None and metadata_df is not None:
        metadata_dataset = TabularDataset(
            id=dataset_in.id,
            name=dataset_in.name,
            index_type_name=dataset_in.index_type_name,
            data_type=dataset_in.data_type,
            is_transient=dataset_in.is_transient,
            group_id=str(dataset_in.group_id),
            taiga_id=dataset_in.taiga_id,
        )
        db.add(metadata_dataset)

        dataset_id = dataset_in.id
        db.flush()
        dimension_type.dataset_id = dataset_id
        db.flush()

        _add_metadata(
            db,
            metadata_df,
            annotation_type_mapping,
            name,
            id_column,
            metadata_dataset,
            units_per_column,
        )

        # Add a mapping that identifies which feature type datasets have columns that refer to other
        # feature type datasets.
        add_id_mapping(db, reference_column_mappings, dataset=metadata_dataset)

        _set_properties_to_index(
            db, properties_to_index, dataset_id, dataset_in.group_id
        )

        populate_search_index(db, user, dataset_id)

    db.flush()

    return dimension_type


def add_dimension_type(
    db: SessionWithUser,
    settings: Settings,
    user: str,
    name: str,
    id_column: str,
    axis: Literal["feature", "sample"],
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
            priority=None,
            dataset_metadata=None,
            dataset_md5=None,  # This may change!
        )

        check_id_mapping_is_valid(db, reference_column_mappings)

        dimension_type = _add_dimension_type(
            db,
            user=user,
            name=name,
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

        dimension_type = _add_dimension_type(
            db, user=user, name=name, id_column=id_column, axis=axis,
        )

    return dimension_type


def get_dimension_types(
    db: SessionWithUser, axis: Optional[Literal["feature", "sample"]] = None
) -> List[DimensionType]:
    q = db.query(DimensionType)
    if axis is not None:
        q = q.filter_by(axis=axis)
    return q.all()


def get_dimension_type(db: SessionWithUser, name: str) -> Optional[DimensionType]:
    return db.query(DimensionType).filter_by(name=name).one_or_none()


def _update_dataset_dimensions_with_dimension_type(
    db: SessionWithUser, dimension_type: DimensionType, metadata_df: pd.DataFrame,
):
    def get_dataset_dimension_axis(
        axis: Union[Literal["feature", "sample"], str]
    ) -> Union[Type[DatasetSample], Type[DatasetFeature]]:
        if axis == "feature":
            return DatasetFeature
        else:
            return DatasetSample

    dataset_dimension = get_dataset_dimension_axis(dimension_type.axis)
    dataset_dimensions_with_dimension_type_query = (
        db.query(dataset_dimension)
        .filter(dataset_dimension.dataset_dimension_type == dimension_type.name)
        .order_by(dataset_dimension.dataset_id, dataset_dimension.index)
    )
    dataset_dimensions_ids = [
        dataset_dim.id
        for dataset_dim in dataset_dimensions_with_dimension_type_query.all()
    ]
    db.query(CatalogNode).filter(
        CatalogNode.dimension_id.in_(dataset_dimensions_ids)
    ).delete()

    new_dataset_dimension_catalog_nodes = []
    updated_dimension_labels = []

    dims_grouped_by_dataset_df = pd.read_sql(
        dataset_dimensions_with_dimension_type_query.statement,
        dataset_dimensions_with_dimension_type_query.session.connection(),
    ).groupby("dataset_id")
    for dataset_key in dims_grouped_by_dataset_df.groups.keys():
        dataset_catalog_node = (
            db.query(CatalogNode)
            .filter(
                and_(
                    CatalogNode.dimension_id.is_(None),
                    CatalogNode.dataset_id == dataset_key,
                )
            )
            .one()
        )
        dataset_dims_df = dims_grouped_by_dataset_df.get_group(dataset_key)
        # Rename dimension 'id' column in case of collision in naming where dimension type identifier is also named 'id'
        dataset_dims_df.rename(columns={"id": "dimension_id"}, inplace=True)
        dimensions_df = dataset_dims_df.merge(
            metadata_df, "left", left_on="given_id", right_on=dimension_type.id_column
        ).replace({np.nan: None})
        for i, row in dimensions_df.iterrows():
            dimension_label = (
                str(row["label"]) if row["label"] is not None else row["given_id"]
            )
            new_dim_nodes = _create_dataset_dimension_catalog_nodes(
                row, row["dimension_id"], dimension_label, dataset_catalog_node
            )
            new_dataset_dimension_catalog_nodes.extend(new_dim_nodes)
            if dimension_type.axis == "feature":
                if (
                    dimension_label != row["feature_label"]
                ):  # TODO: add label field to DatasetSample too..
                    updated_dimension_labels.append(
                        {"id": row["dimension_id"], "feature_label": row["label"]}
                    )
    if dimension_type.axis == "feature":  # TODO: add label field to DatasetSample too..
        for i in range(0, len(updated_dimension_labels), 10000):  # arbitrary chunk size
            chunk = i + 10000
            db.bulk_update_mappings(DatasetFeature, updated_dimension_labels[i:chunk])
    db.flush()
    add_catalog_nodes(db, new_dataset_dimension_catalog_nodes)
    db.flush()


def update_dimension_type(
    db: SessionWithUser,
    user: str,
    filestore_location: str,
    dimension_type: DimensionType,
    metadata_dataset: TabularDataset,
    properties_to_index: List[str],
):

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

    _set_properties_to_index(
        db, properties_to_index, metadata_dataset.id, metadata_dataset.group_id
    )

    populate_search_index(db, user, metadata_dataset.id)

    db.flush()


def update_dimension_type_metadata(
    db: SessionWithUser,
    user: str,
    filestore_location: str,
    dimension_type: DimensionType,
    file_name: str,
    metadata_df: pd.DataFrame,
    annotation_type_mapping: Dict[str, AnnotationType],
    taiga_id: Optional[str],
    reference_column_mappings: Optional[Dict[str, Any]] = None,
    properties_to_index: Optional[List[str]] = None,
    units_per_column: Optional[Dict[str, str]] = None,
) -> DimensionType:
    if units_per_column is None:
        units_per_column = {}

    if dimension_type.dataset is not None:
        # before deleting the dataset, save the current list of properties to index if the caller didn't supply
        # a list.
        if properties_to_index is None:
            properties_to_index = get_properties_to_index(
                db, user, dimension_type.dataset.id
            )

        # Delete dataset and catalog nodes with dataset id; cascade deletes annotation dimensions which then deletes all annotation values
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
    dimension_type.dataset_id = dataset_id
    db.flush()

    _add_metadata(
        db,
        metadata_df,
        annotation_type_mapping,
        dimension_type.name,
        dimension_type.id_column,
        dimension_type_metadata,
        units_per_column,
    )
    _update_dataset_dimensions_with_dimension_type(db, dimension_type, metadata_df)

    if reference_column_mappings and len(reference_column_mappings.keys()) > 0:
        add_id_mapping(db, reference_column_mappings, dataset=dimension_type_metadata)

    if properties_to_index and len(properties_to_index) > 0:
        _set_properties_to_index(
            db, properties_to_index, dataset_id, dimension_type_metadata.group_id
        )

    populate_search_index(db, user, dataset_id)

    db.flush()
    return dimension_type


def delete_dimension_type(db: SessionWithUser, dimension_type: DimensionType):
    # NOTE: Delete feature type if has dataset should cascade deletes
    db.delete(dimension_type)
    # NOTE: Manually delete dataset's CatalogNodes instead of relying foreign key
    # constraints and cascade deletes because the self-referencing relationship is causing
    # large performance issues. Notice how there are no foreign key constraints only for
    # catalog_node in models
    if dimension_type.axis == "feature":
        feature_type_metadata_dataset_id = dimension_type.dataset_id
        if feature_type_metadata_dataset_id:
            db.query(CatalogNode).filter(
                CatalogNode.dataset_id == feature_type_metadata_dataset_id
            ).delete()

    db.flush()
    return True


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
    if reference_column_mappings and not _check_id_mapping_is_valid(
        db, reference_column_mappings
    ):
        raise UserError(
            "Attempted reference mapping to a dimension type that does not exist!"
        )
