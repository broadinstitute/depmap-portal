import logging
from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Dict, Optional, List, Type, Union, Tuple, Set
from uuid import UUID, uuid4
import warnings

import pandas as pd
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import aliased, with_polymorphic

from breadbox.db.session import SessionWithUser
from ..io.data_validation import dimension_label_df_schema
from ..schemas.dataset import (
    MatrixDatasetIn,
    TabularDatasetIn,
    DimensionSearchIndexResponse,
    ColumnMetadata,
    UpdateDatasetParams,
)

from ..schemas.custom_http_exception import (
    DatasetAccessError,
    ResourceNotFoundError,
    UserError,
)
from breadbox.crud.access_control import user_has_access_to_group
from breadbox.models.dataset import (
    AnnotationType,
    Dataset,
    MatrixDataset,
    TabularDataset,
    DatasetFeature,
    DatasetSample,
    Dimension,
    DimensionSearchIndex,
    TabularColumn,
    TabularCell,
    PropertyToIndex,
    ValueType,
    DimensionType,
    PrecomputedAssociation,
)
from breadbox.crud.group import (
    get_group,
    get_groups_with_visible_contents,
    TRANSIENT_GROUP_ID,
    get_transient_group,
)
from breadbox.io.filestore_crud import delete_data_files
from .metadata import cast_tabular_cell_value_type
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
    data_type: Optional[str] = None,
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
    # TODO: 'feature_id' and 'sample_id' filters only returns for matrix datasets!
    # Decide if should return for metadata when given feature id/type or sample id/type
    # TODO: feature type can be none. How should we filter those datasets?
    if feature_type is not None:
        # Make sure that the `feature_type` dimension type is actually in the feature axis so tabular datasets are correctly filtered
        feature_dimension_type = (
            db.query(DimensionType).filter_by(name=feature_type).one_or_none()
        )
        if feature_dimension_type and feature_dimension_type.axis == "feature":
            filter_clauses.append(
                or_(
                    dataset_poly.MatrixDataset.feature_type_name == feature_type,
                    dataset_poly.TabularDataset.index_type_name == feature_type,
                )
            )
        else:
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
        # Make sure that the `sample_type` dimension type is actually in the sample axis so tabular datasets are correctly filtered
        sample_dimension_type = (
            db.query(DimensionType).filter_by(name=sample_type).one_or_none()
        )
        if sample_dimension_type and sample_dimension_type.axis == "sample":
            filter_clauses.append(
                or_(
                    dataset_poly.MatrixDataset.sample_type_name == sample_type,
                    dataset_poly.TabularDataset.index_type_name == sample_type,
                )
            )
        else:
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

    if data_type is not None:
        filter_clauses.append(Dataset.data_type == data_type)

    datasets = db.query(dataset_poly).filter(and_(True, *filter_clauses)).all()
    return datasets


def get_dataset(
    db: SessionWithUser, user: str, dataset_id: Union[str, UUID]
) -> Optional[Dataset]:
    """Get a dataset either by ID or given ID."""
    assert (
        db.user == user
    ), f"User parameter '{user}' must match the user set on the database session '{db.user}'"

    dataset: Optional[Dataset] = db.query(Dataset).filter(
        or_(Dataset.id == str(dataset_id), Dataset.given_id == str(dataset_id))
    ).one_or_none()

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

    _add_matrix_dataset_dimensions(
        db=db,
        index_and_given_id=feature_given_id_and_index_df,
        dimension_subtype_cls=DatasetFeature,
        dimension_type_name=feature_type.name if feature_type else None,
        dataset=dataset,
    )
    _add_matrix_dataset_dimensions(
        db=db,
        index_and_given_id=sample_given_id_and_index_df,
        dimension_subtype_cls=DatasetSample,
        dimension_type_name=sample_type.name,
        dataset=dataset,
    )

    db.flush()

    return dataset


@dataclass
class PropertyMetadata:
    value: str
    dimension_id: str


#    annotation_type: AnnotationType


@dataclass
class DatasetDimensionMetadata:
    dimension_given_id: str
    axis: str
    type_name: str
    label: str
    property_metadata: Dict[str, PropertyMetadata]


@dataclass
class PropertyValuePair:
    property: str
    value: str


# TODO: replace
def get_metadata_by_dataset(
    db: SessionWithUser, dataset: Dataset, properties_to_index: List[str]
) -> pd.DataFrame:
    from ..crud import types as types_crud

    by_property = {}

    index_type_name = dataset.index_type_name
    for property in properties_to_index:
        value_per_given_id = types_crud.get_dimension_type_metadata_col(
            db, dimension_type_name=index_type_name, col_name=property
        )

        by_property[property] = pd.Series(value_per_given_id)

    return pd.DataFrame(by_property)


@dataclass
class MetadataCacheEntry:
    properties_to_index_df: pd.DataFrame
    columns_metadata: Dict[str, ColumnMetadata]
    label_by_given_id: Dict[str, str]


class MetadataCache:
    db: SessionWithUser
    cache: Dict[str, MetadataCacheEntry]

    def __init__(self, db: SessionWithUser):
        self.cache = {}
        self.db = db

    def get(self, dimension_type_name: str):
        from .types import get_given_id_to_dimension_id_mapping
        from ..crud import types as types_crud

        if dimension_type_name in self.cache:
            entry = self.cache[dimension_type_name]
        else:
            dimension_type = types_crud.get_dimension_type(self.db, dimension_type_name)
            assert dimension_type is not None
            if dimension_type.dataset is None:
                columns_metadata = {}
                properties_to_index_df = pd.DataFrame({})
                dimension_id_by_given_id = {}
                label_by_given_id = {}
            else:
                print(dimension_type.dataset.index_type_name)

                properties_to_index = [
                    x.property for x in dimension_type.properties_to_index
                ]

                properties_to_index_df = get_metadata_by_dataset(
                    db=self.db,
                    dataset=dimension_type.dataset,
                    properties_to_index=properties_to_index,
                )

                columns_metadata = dimension_type.dataset.columns_metadata

                label_by_given_id = types_crud.get_dimension_type_metadata_col(
                    self.db, dimension_type_name=dimension_type.name, col_name="label"
                )

            entry = MetadataCacheEntry(
                properties_to_index_df=properties_to_index_df,
                columns_metadata=columns_metadata,
                label_by_given_id=label_by_given_id,
            )
            self.cache[dimension_type_name] = entry

        return entry


def get_property_value_pairs_for_given_id(
    db, dimension_type_name: str, given_id: str, metadata_cache: MetadataCache
) -> List[PropertyValuePair]:
    dimension_search_index_rows = []

    md_entry = metadata_cache.get(dimension_type_name)
    properties_to_index_df = md_entry.properties_to_index_df
    columns_metadata = md_entry.columns_metadata

    # TODO: Rewrite
    print("warning: inefficient. Rewrite")
    rows_by_index = {}
    for record in properties_to_index_df.to_records():
        rows_by_index[record.index] = record

    row = rows_by_index[given_id]

    # if this ID is not specified, then just move on.
    if row is not None:
        # create one or more search index record for each column in properties_to_index_df
        for property in properties_to_index_df.columns:
            property_value = row[property]
            cm = columns_metadata[property]

            # now, check to see if we have a single value or multiple
            if property_value is None:
                values = []
            elif cm.col_type == AnnotationType.list_strings:
                values = cast_tabular_cell_value_type(
                    property_value, AnnotationType.list_strings
                )
                assert isinstance(values, list)
            else:
                values = [property_value]

            # are these values references to a keys in a different table
            if cm.references is not None:
                for value in values:
                    for search_index_record in get_property_value_pairs_for_given_id(
                        db,
                        dimension_type_name=cm.references,
                        given_id=value,
                        metadata_cache=metadata_cache,
                    ):
                        # prefix the property name before adding to the index with the name
                        # of the relationship that we traversed to get it. (this let's us
                        # distinguish those properties which have the same name. For example, for
                        # a compound, we'll get "alias" which is an alternative name for the
                        # compound and "target.alias" which is an alternative name for the gene targeted
                        # by the compound)
                        dimension_search_index_rows.append(
                            PropertyValuePair(
                                property=f"{property}.{search_index_record.property}",
                                value=search_index_record.value,
                            )
                        )
            else:
                # if not, then just add a search index record for each value
                for value in values:
                    dimension_search_index_rows.append(
                        PropertyValuePair(property=property, value=value,),
                    )

    return dimension_search_index_rows


def get_properties_to_index_query_for_metadata_dataset(
    db: SessionWithUser, metadata_dataset_id: str, properties_to_index: List[str],
):
    filter_clauses = [
        DimensionType.dataset_id == metadata_dataset_id,
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


def _get_datatypes_referencing(db, dimension_type_name):
    "Find the transitive closure over dimension types that reference other dimension types."
    seen_names = set()

    def _add_referencing_dimension_type(dimension_type_name: str):
        assert isinstance(dimension_type_name, str)

        seen_names.add(dimension_type_name)

        # find any columns which reference this type
        datasets_result = (
            db.query(DimensionType)
            .join(TabularDataset, TabularDataset.id == DimensionType.dataset_id)
            .join(TabularColumn)
            .filter(TabularColumn.references_dimension_type_name == dimension_type_name)
            .with_entities(DimensionType.name,)
            .all()
        )

        for (referencing_dimension_type_name,) in datasets_result:
            if referencing_dimension_type_name not in seen_names:
                # if we haven't seen those yet, add any columns that reference those too
                _add_referencing_dimension_type(referencing_dimension_type_name)

    _add_referencing_dimension_type(dimension_type_name)
    return seen_names


def _refresh_search_index_for_dimension_type(
    db: SessionWithUser, dimension_type_name: str, metadata_cache: MetadataCache
):
    log.info(
        "_refresh_search_index_for_dimension_type %s starting", dimension_type_name
    )
    from .types import get_dimension_type

    dimension_type = get_dimension_type(db, dimension_type_name)
    assert dimension_type is not None

    if dimension_type.dataset_id is not None:
        #        breakpoint()
        assert user_has_access_to_group(
            dimension_type.dataset.group, db.user, write_access=True
        ), "Sign of user not having access to dataset needing to be indexed"

        # before creating records in the search index for this dimension_type, clear out any previously existing records
        log.info("_delete_search_index_records start")
        _delete_search_index_records(db, dimension_type)
        log.info("_delete_search_index_records complete")

    dimension_search_index_rows = []

    cache_entry = metadata_cache.get(dimension_type.name)

    for given_id in cache_entry.properties_to_index_df.index:
        for record in get_property_value_pairs_for_given_id(
            db=db,
            dimension_type_name=dimension_type.name,
            given_id=given_id,
            metadata_cache=metadata_cache,
        ):
            # if given_id in cache_entry.dimension_id_by_given_id:
            dimension_search_index_rows.append(
                DimensionSearchIndex(
                    # dimension_id=cache_entry.dimension_id_by_given_id[given_id],
                    property=record.property,
                    value=record.value,
                    group_id=dimension_type.dataset.group_id,
                    dimension_type_name=dimension_type.name,
                    dimension_given_id=given_id,
                    label=cache_entry.label_by_given_id[given_id],
                )
            )

    log.info("_refresh_search_index_for_dimension_type generated records. Writing...")

    db.bulk_save_objects(dimension_search_index_rows)
    log.info("_refresh_search_index_for_dimension_type complete")


def populate_search_index(db: SessionWithUser, dimension_type: DimensionType):
    impacted_dimension_types = _get_datatypes_referencing(db, dimension_type.name)

    md = MetadataCache(db)
    for impacted_dimension_types in impacted_dimension_types:
        _refresh_search_index_for_dimension_type(db, impacted_dimension_types, md)
    db.flush()


def _delete_search_index_records(db: SessionWithUser, dimension_type: DimensionType):
    db.query(DimensionSearchIndex).filter(
        DimensionSearchIndex.dimension_type_name == dimension_type.name
    ).delete()

    db.flush()
    return True


def _add_matrix_dataset_dimensions(
    db: SessionWithUser,
    index_and_given_id: pd.DataFrame,
    dimension_subtype_cls: Union[Type[DatasetFeature], Type[DatasetSample]],
    dimension_type_name: Optional[str],
    dataset: MatrixDataset,
):
    dimensions: List[Union[DatasetFeature, DatasetSample]] = []

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

    db.bulk_save_objects(dimensions)
    db.flush()


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

    _add_tabular_dimensions(
        db, data_df, columns_metadata, dataset.id, dimension_type, group_id=group.id
    )

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
    from .types import get_dimension_type

    """
    Adds tabular dataset dimensions to database.
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

    for column_name, column_metadata in columns_metadata.items():
        if column_metadata.references is not None:
            dim_type = get_dimension_type(db, column_metadata.references)
            if dim_type is None:
                raise ValueError(
                    f"The column {column_name} references {column_metadata.references} which does not exit"
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
                references_dimension_type_name=columns_metadata[col].references,
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
    prefixes: List[str],
    substrings: List[str],
    dimension_type_name: Optional[str],
    include_referenced_by: bool,
):
    # Filter out any datasets the user doesn't have access to
    visible_database_clause = get_dataset_filter_clauses(db, user)

    search_index_filter_clauses = []
    outer = aliased(DimensionSearchIndex)

    if dimension_type_name:
        search_index_filter_clauses.append(
            outer.dimension_type_name == dimension_type_name
        )

    def filter_per_value(values, predicate_constructor):
        if len(values) == 0:
            return []

        exists_clause_per_value = [
            db.query(DimensionSearchIndex)
            .filter(
                and_(
                    predicate_constructor(DimensionSearchIndex, value),
                    *search_index_filter_clauses,
                    outer.dimension_type_name
                    == DimensionSearchIndex.dimension_type_name,
                    outer.dimension_given_id == DimensionSearchIndex.dimension_given_id,
                )
            )
            .with_entities(
                DimensionSearchIndex.dimension_type_name,
                DimensionSearchIndex.dimension_given_id,
            )
            .exists()
            for value in values
        ]

        property_matches_at_least_one_predicate = or_(
            *[predicate_constructor(outer, value) for value in values]
        )

        return [property_matches_at_least_one_predicate] + exists_clause_per_value

    filters_for_prefixes = filter_per_value(
        prefixes, lambda table, prefix: table.value.startswith(prefix, autoescape=True)
    )

    filters_for_substrings = filter_per_value(
        substrings,
        lambda table, substring: table.value.contains(substring, autoescape=True),
    )

    from sqlalchemy import text

    search_index_query = (
        db.query(outer)
        .filter(
            and_(
                True,
                *(
                    search_index_filter_clauses
                    + filters_for_substrings
                    + filters_for_prefixes
                ),
            )
        )
        .limit(limit)
        .with_entities(
            outer.dimension_type_name,
            outer.dimension_given_id,
            outer.label,
            outer.property,
            outer.value,
        )
    )

    search_index_entries = pd.read_sql(
        search_index_query.statement, search_index_query.session.connection()
    )
    #    search_index_entries.columns = ["type_name", "dimension_given_id", "label", "property", "value"]

    grouped_search_index_entries = search_index_entries.groupby(
        ["dimension_given_id", "dimension_type_name"],
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

    # sort at the end. This has been moved out of the sql query because we
    # want the sort to happen after "limit" has been applied.
    group_entries.sort(key=lambda x: (x.label, x.type_name))

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


def get_matrix_dataset_features(
    db: SessionWithUser, dataset: MatrixDataset
) -> list[DatasetFeature]:
    assert_user_has_access_to_dataset(dataset, db.user)

    dataset_features = (
        db.query(DatasetFeature)
        .filter(DatasetFeature.dataset_id == dataset.id)
        .order_by(DatasetFeature.given_id)
        .all()
    )

    return dataset_features


def get_matrix_dataset_samples(
    db: SessionWithUser, dataset: MatrixDataset
) -> list[DatasetSample]:
    assert_user_has_access_to_dataset(dataset, db.user)

    dataset_samples = (
        db.query(DatasetSample)
        .filter(DatasetSample.dataset_id == dataset.id)
        .order_by(DatasetSample.given_id)
        .all()
    )

    return dataset_samples


def get_tabular_dataset_index_given_ids(
    db: SessionWithUser, dataset: TabularDataset
) -> list[str]:
    """
    Get all row given IDs belonging to a tabular dataset.
    This can be used for joining the metadata that's relevant for this particular dataset.
    Warning: this may contain given IDs that do not exist in the metadata.
    """
    dimension_type = (
        db.query(DimensionType).filter_by(name=dataset.index_type_name).one_or_none()
    )
    assert dimension_type is not None

    id_col_name = dimension_type.id_column
    cells_in_id_column = (
        db.query(TabularCell)
        .join(TabularColumn)
        .filter(
            and_(
                TabularColumn.dataset_id == dataset.id,
                TabularColumn.given_id == id_col_name,
            )
        )
        .all()
    )
    return [cell.dimension_given_id for cell in cells_in_id_column]


def get_matching_feature_metadata_labels(
    db: SessionWithUser, feature_labels: List[str]
) -> set[str]:
    """
    DEPRECATED: this method should be removed when the old data_slicer functionality is replaced.
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
    db: SessionWithUser, user: str, dataset: Dataset, new_values: UpdateDatasetParams
):
    update_data = new_values.model_dump(exclude_unset=True)
    if "group_id" in update_data:
        new_group = get_group(db, user, update_data["group_id"], write_access=False)
        if new_group is None:
            raise ResourceNotFoundError(f"Group not found: {update_data['group_id']}")

        if not user_has_access_to_group(dataset.group, user, write_access=True):
            raise DatasetAccessError(f"User {user} cannot access this dataset!")
        if not user_has_access_to_group(new_group, user, write_access=True):
            raise DatasetAccessError("User {user} cannot access this dataset!")

    for key, value in update_data.items():
        if key != "format":
            setattr(dataset, key, value)
        if key == "group_id" and value is not None:
            setattr(dataset, key, str(value))

    db.flush()
    return dataset


def delete_dataset(
    db: SessionWithUser, user: str, dataset: Dataset, filestore_location: str
):
    from .associations import delete_association_table

    if not user_has_access_to_group(dataset.group, user, write_access=True):
        return False

    log.info("delete any referenced precomputed associations")
    for associations in (
        db.query(PrecomputedAssociation)
        .filter(
            or_(
                PrecomputedAssociation.dataset_1_id == dataset.id,
                PrecomputedAssociation.dataset_2_id == dataset.id,
            )
        )
        .all()
    ):
        delete_association_table(db, associations.id, filestore_location)

    log.info("delete Dimension")
    db.query(Dimension).filter(Dimension.dataset_id == dataset.id).delete()
    log.info("delete_dataset %s delete dataset itself", dataset.id)
    db.delete(dataset)

    # Matrix dataset files are stored as hdf5 and need to be deleted as well
    if dataset.format == "matrix_dataset":
        delete_data_files(dataset.id, filestore_location)

    log.info("delete_dataset %s complete", dataset.id)
    return True


def get_dataset_feature_by_given_id(
    db: SessionWithUser, dataset_id: str, feature_given_id: str,
) -> DatasetFeature:
    dataset = get_dataset(db, db.user, dataset_id)
    if dataset is None:
        raise ResourceNotFoundError(f"Dataset '{dataset_id}' not found.")
    assert_user_has_access_to_dataset(dataset, db.user)
    assert isinstance(dataset, MatrixDataset)

    feature = (
        db.query(DatasetFeature)
        .filter(
            DatasetFeature.given_id == feature_given_id,
            DatasetFeature.dataset_id == dataset.id,
        )
        .one_or_none()
    )

    if feature is None:
        raise ResourceNotFoundError(
            f"Feature given ID '{feature_given_id}' not found in dataset '{dataset_id}'."
        )
    return feature


def get_dataset_sample_by_given_id(
    db: SessionWithUser, dataset_id: str, sample_given_id: str,
) -> DatasetSample:
    dataset = get_dataset(db, db.user, dataset_id)
    if dataset is None:
        raise ResourceNotFoundError(f"Dataset '{dataset_id}' not found.")
    assert_user_has_access_to_dataset(dataset, db.user)
    assert isinstance(dataset, MatrixDataset)

    sample = (
        db.query(DatasetSample)
        .filter(
            DatasetSample.given_id == sample_given_id,
            DatasetSample.dataset_id == dataset.id,
        )
        .one_or_none()
    )

    if sample is None:
        raise ResourceNotFoundError(
            f"Sample given ID '{sample_given_id}' not found in dataset '{dataset_id}'."
        )
    return sample


def get_subset_of_tabular_data_as_df(
    db: SessionWithUser,
    dataset: TabularDataset,
    column_names: Optional[list[str]],
    index_given_ids: Optional[list[str]],
) -> pd.DataFrame:
    filter_statements = [TabularColumn.dataset_id == dataset.id]
    if column_names is not None:
        filter_statements.append(TabularColumn.given_id.in_(column_names))
    if index_given_ids is not None:
        filter_statements.append(TabularCell.dimension_given_id.in_(index_given_ids))
    query = (
        db.query(TabularColumn)
        .join(TabularCell)
        .filter(and_(True, *filter_statements))
        .with_entities(
            TabularCell.value, TabularCell.dimension_given_id, TabularColumn.given_id,
        )
    )
    query_df = pd.read_sql(query.statement, query.session.connection())

    # Pivot table so that the indices are the index of the df and the given columns are the columns of the df
    # NOTE: resulting df will have columns as multi index ("value", "given_id") so will need to index df by "value" to get final df
    pivot_df = query_df.pivot(index="dimension_given_id", columns="given_id")

    # If df is empty, there is no 'value' key to index by
    if pivot_df.empty:
        return pivot_df

    return pivot_df["value"]


def get_unique_dimension_ids_from_datasets(
    db: SessionWithUser, dataset_ids: List[str], dimension_type: DimensionType
) -> Set[str]:
    """
    Returns a unique set of dimension given ids from matrix and tabular datasets based on the given dimension type
    """
    if dimension_type.axis == "feature":
        matrix_dimension_class = DatasetFeature
    else:
        matrix_dimension_class = DatasetSample

    unique_dims = set()

    # Get all matrix dimensions for that dimension type
    matrix_dimensions = (
        db.query(matrix_dimension_class)
        .filter(
            and_(
                Dimension.dataset_id.in_(dataset_ids),
                Dimension.dataset_dimension_type == dimension_type.name,
            )
        )
        .all()
    )
    # Get all tabular identifiers for that dimension type
    tabular_dimension_ids = (
        db.query(TabularCell)
        .join(TabularColumn)
        .filter(
            and_(
                TabularColumn.dataset_id.in_(dataset_ids),
                TabularColumn.given_id == dimension_type.id_column,
                TabularColumn.dataset_dimension_type == dimension_type.name,
            )
        )
        .all()
    )
    # Combine dimension type's dimension given ids from datasets
    for m_dim in matrix_dimensions:
        unique_dims.add(m_dim.given_id)

    for t_dim in tabular_dimension_ids:
        unique_dims.add(t_dim.dimension_given_id)

    return unique_dims
