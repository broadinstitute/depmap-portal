from typing import Dict, List, Literal, Optional, Type, Union
from uuid import uuid4

from sqlalchemy import and_, inspect

import pandas as pd
import numpy as np

from breadbox.db.session import SessionWithUser
from breadbox.schemas.custom_http_exception import (
    ResourceNotFoundError,
    DimensionTypeNotFoundError,
)
from breadbox.schemas.dataset import TabularDatasetIn
from breadbox.models.dataset import (
    AnnotationType,
    TabularCell,
    TabularColumn,
    TabularDataset,
    DatasetSample,
    DatasetFeature,
    DimensionType,
    PropertyToIndex,
)


def set_properties_to_index(
    db: SessionWithUser,
    properties_to_index: List[str],
    dimension_type_name: str,
    group_id: str,
):
    property_to_index_rows = []

    db.query(PropertyToIndex).filter(
        PropertyToIndex.dimension_type_name == dimension_type_name
    ).delete()
    db.flush()

    for property in properties_to_index:
        property_to_index_rows.append(
            PropertyToIndex(
                dimension_type_name=dimension_type_name,
                property=property,
                group_id=group_id,
            )
        )

    if len(property_to_index_rows) > 0:
        db.bulk_save_objects(property_to_index_rows)
        db.flush()


def add_metadata_dimensions(
    db: SessionWithUser,
    annotations_df: pd.DataFrame,
    annotation_type_mapping: Dict[str, AnnotationType],
    dataset_dimension_type_name: str,
    id_column: str,
    dataset: TabularDataset,
    units_per_column: Dict[str, str],
    reference_column_mappings: Dict[str, str],
):
    col_annotations: List[TabularColumn] = []
    col_annotation_ids: Dict = {}
    annotation_values: List[TabularCell] = []

    for col in annotations_df.columns:
        annotation_id = str(uuid4())
        annotation_type = annotation_type_mapping[col]
        references_dimension_type_name = reference_column_mappings.get(col)
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
                references_dimension_type_name=references_dimension_type_name,
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

    db.bulk_save_objects(col_annotations)
    db.flush()
    db.bulk_save_objects(annotation_values)
    db.flush()


def add_dimension_type(
    db: SessionWithUser,
    name: str,
    id_column: str,
    axis: Literal["feature", "sample"],
    display_name: Optional[str] = None,
    dataset_in: Optional[TabularDatasetIn] = None,
    metadata_df: Optional[pd.DataFrame] = None,
    annotation_type_mapping: Optional[Dict[str, AnnotationType]] = None,
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
        name=name,
        display_name=display_name,
        axis=axis,
        dataset_id=dataset_id,
        id_column=id_column,
    )
    db.add(dimension_type)
    db.flush()

    if dataset_in is not None and metadata_df is not None:
        group_id = str(dataset_in.group_id)
        metadata_dataset = TabularDataset(
            id=dataset_in.id,
            name=dataset_in.name,
            index_type_name=dataset_in.index_type_name,
            data_type=dataset_in.data_type,
            is_transient=dataset_in.is_transient,
            group_id=group_id,
            taiga_id=dataset_in.taiga_id,
        )
        db.add(metadata_dataset)

        dataset_id = dataset_in.id
        db.flush()
        dimension_type.dataset_id = dataset_id  # pyright: ignore
        db.flush()

        add_metadata_dimensions(
            db=db,
            annotations_df=metadata_df,
            annotation_type_mapping=annotation_type_mapping,
            dataset_dimension_type_name=name,
            id_column=id_column,
            dataset=metadata_dataset,
            units_per_column=units_per_column,
            reference_column_mappings=reference_column_mappings,
        )

        db.flush()
        set_properties_to_index(db, properties_to_index, dimension_type.name, group_id)

    db.flush()

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


def update_dataset_dimensions_with_dimension_type(
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

    updated_dimension_labels = []

    dims_grouped_by_dataset_df = pd.read_sql(
        dataset_dimensions_with_dimension_type_query.statement,
        dataset_dimensions_with_dimension_type_query.session.connection(),
    ).groupby("dataset_id")
    for dataset_key in dims_grouped_by_dataset_df.groups.keys():
        dataset_dims_df = dims_grouped_by_dataset_df.get_group(dataset_key)
        # Rename dimension 'id' column in case of collision in naming where dimension type identifier is also named 'id'
        dataset_dims_df.rename(
            columns={"id": "dimension_id"}, inplace=True
        )  # pyright: ignore
        dimensions_df = dataset_dims_df.merge(
            metadata_df, "left", left_on="given_id", right_on=dimension_type.id_column
        ).replace({np.nan: None})
        for i, row in dimensions_df.iterrows():
            dimension_label = (
                str(row["label"]) if row["label"] is not None else row["given_id"]
            )
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
            db.bulk_update_mappings(
                inspect(DatasetFeature), updated_dimension_labels[i:chunk]
            )
    db.flush()


def delete_dimension_type(db: SessionWithUser, dimension_type: DimensionType):
    """Delete the dimension type as well as its metadata dataset."""
    db.delete(dimension_type)
    db.flush()
    return True


def get_dimension_type_labels_by_id(
    db: SessionWithUser, dimension_type_name: str, limit: Optional[int] = None
) -> dict[str, str]:
    """
    For a given dimension, get all IDs and labels that exist in the metadata.
    """
    return get_dimension_type_metadata_col(
        db, dimension_type_name, col_name="label", limit=limit
    )


def get_dimension_type_metadata_col(
    db: SessionWithUser,
    dimension_type_name: str,
    col_name: str,
    limit: Optional[int] = None,
) -> dict[str, str]:
    assert isinstance(col_name, str)

    """
    Get a column of values from the dimension type's metadata. 
    Return a dictionary of values indexed by given ID.
    If there is no metadata for the given dimension type, return an empty dict.
    """
    dimension_type = get_dimension_type(db=db, name=dimension_type_name)

    if dimension_type is None:
        raise DimensionTypeNotFoundError(
            f"Dimension type '{dimension_type_name}' not found. "
        )
    if dimension_type.dataset_id is None:
        return {}

    values_by_id_tuples = (
        db.query(TabularColumn)
        .filter(
            and_(
                TabularColumn.dataset_id == dimension_type.dataset_id,
                TabularColumn.given_id == col_name,
            )
        )
        .join(TabularCell)
        .limit(limit)
        .with_entities(TabularCell.dimension_given_id, TabularCell.value)
        .all()
    )
    return {id: value for id, value in values_by_id_tuples}
