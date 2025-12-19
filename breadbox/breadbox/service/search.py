import logging
from dataclasses import dataclass
from typing import Dict, List

import pandas as pd
from sqlalchemy import insert

from ..crud.metadata import cast_tabular_cell_value_type
from ..crud import dimension_types as types_crud

from breadbox.db.session import SessionWithUser
from ..schemas.dataset import ColumnMetadata

from breadbox.crud.access_control import user_has_access_to_group
from breadbox.models.dataset import (
    AnnotationType,
    Dataset,
    TabularDataset,
    DimensionSearchIndex,
    TabularColumn,
    DimensionType,
)
from ..crud.dimension_types import get_dimension_type, get_dimension_type_metadata_col

log = logging.getLogger(__name__)


@dataclass
class PropertyValuePair:
    property: str
    value: str


@dataclass
class MetadataCacheEntry:
    properties_to_index_df: pd.DataFrame
    columns_metadata: Dict[str, ColumnMetadata]

    def get_label_for_given_id(self, given_id):
        try:
            return self.properties_to_index_df.loc[given_id, "label"]
        except KeyError:
            return None

    def get_properties_dict(self, given_id: str):
        try:
            return self.properties_to_index_df.loc[given_id].to_dict()
        except KeyError:
            return None


class MetadataCache:
    db: SessionWithUser
    cache: Dict[str, MetadataCacheEntry]

    def __init__(self, db: SessionWithUser):
        self.cache = {}
        self.db = db

    def get(self, dimension_type_name: str):
        if dimension_type_name in self.cache:
            entry = self.cache[dimension_type_name]
        else:
            dimension_type = get_dimension_type(self.db, dimension_type_name)
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

                columns_metadata = dict(dimension_type.dataset.columns_metadata)

            rows_by_index = {}
            for record in properties_to_index_df.to_records():
                rows_by_index[record.index] = record

            entry = MetadataCacheEntry(
                properties_to_index_df=properties_to_index_df,
                columns_metadata=columns_metadata,
            )
            self.cache[dimension_type_name] = entry

        return entry


def populate_search_index_after_update(
    db: SessionWithUser, dimension_type: DimensionType
):
    """
    Update the search index for all dimension_types impacted by `dimension_type` changing in some way.
    """
    from breadbox.crud.dimension_ids import _populate_dimension_type_labels

    _populate_dimension_type_labels(db, dimension_type.name)

    impacted_dimension_types = _get_datatypes_referencing(db, dimension_type.name)

    md = MetadataCache(db)
    for impacted_dimension_types in impacted_dimension_types:
        refresh_search_index_for_dimension_type(db, impacted_dimension_types, md)
    db.flush()


def _delete_search_index_records(db: SessionWithUser, dimension_type: DimensionType):
    db.query(DimensionSearchIndex).filter(
        DimensionSearchIndex.dimension_type_name == dimension_type.name
    ).delete()

    db.flush()
    return True


def refresh_search_index_for_dimension_type(
    db: SessionWithUser, dimension_type_name: str, metadata_cache: MetadataCache
):
    """
    Populates search index for a single dimension type. If you need to regenerate the index because the
    dimension_type has changed, call `populate_search_index_after_update` instead of calling this
    directly.
    """
    log.info("refresh_search_index_for_dimension_type %s starting", dimension_type_name)

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

    cache_entry = metadata_cache.get(dimension_type.name)

    def row_generator():
        for given_id in cache_entry.properties_to_index_df.index:
            for record in get_property_value_pairs_for_given_id(
                db=db,
                dimension_type_name=dimension_type.name,
                given_id=given_id,
                metadata_cache=metadata_cache,
            ):
                label = cache_entry.get_label_for_given_id(given_id)
                if label is None:
                    # if we don't have a label, this given_id didn't exist
                    # in metadata, so move on
                    continue

                # if given_id in cache_entry.dimension_id_by_given_id:
                yield dict(
                    property=record.property,
                    value=record.value,
                    group_id=dimension_type.dataset.group_id,
                    dimension_type_name=dimension_type.name,
                    dimension_given_id=given_id,
                    label=label,
                )

    dimension_search_index_row_count = 0
    for batch in _make_batches(row_generator(), batch_size=1000):
        db.execute(insert(DimensionSearchIndex), batch)
        dimension_search_index_row_count += len(batch)
        f"Wrote batch of {len(batch)} search index records for {dimension_type_name}"

    log.info(
        f"Finished writing all {(dimension_search_index_row_count)} search index records for {len(cache_entry.properties_to_index_df.index)} rows in {dimension_type_name}"
    )


def _make_batches(iterable, batch_size):
    batch = []
    for item in iterable:
        batch.append(item)
        if len(batch) >= batch_size:
            yield batch
            batch = []
    if len(batch) > 0:
        yield batch


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


def get_property_value_pairs_for_given_id(
    db, dimension_type_name: str, given_id: str, metadata_cache: MetadataCache
) -> List[PropertyValuePair]:
    dimension_search_index_rows = []

    md_entry = metadata_cache.get(dimension_type_name)
    properties_to_index_df = md_entry.properties_to_index_df
    columns_metadata = md_entry.columns_metadata

    row = md_entry.get_properties_dict(given_id)
    # if this ID is not specified, then just move on.
    if row is not None:
        # create one or more search index record for each column in properties_to_index_df
        for property in properties_to_index_df.columns:
            property_value = row[property]
            if property not in columns_metadata:
                continue
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


# TODO: replace
def get_metadata_by_dataset(
    db: SessionWithUser, dataset: Dataset, properties_to_index: List[str]
) -> pd.DataFrame:

    by_property = {}

    index_type_name = dataset.index_type_name
    for property in properties_to_index:
        value_per_given_id = types_crud.get_dimension_type_metadata_col(
            db, dimension_type_name=index_type_name, col_name=property
        )

        by_property[property] = pd.Series(value_per_given_id)

    return pd.DataFrame(by_property)
