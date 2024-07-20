import sqlite3
from typing import List, Tuple, Optional
import pandas as pd
from collections import namedtuple
from depmap.partials.matrix.models import RowMatrixIndex, Matrix
from depmap.dataset.models import Dataset
from depmap.correlation.models import CorrelatedDataset, SearchAxis
from depmap.entity.models import Entity
import os
from flask import current_app


IndexWithCorrelation = namedtuple("IndexWithCorrelation", "index cor")
EntityWithCorrelation = namedtuple(
    "EntityWithCorrelation", "entity_id entity_label cor"
)


CORRELATION_COLUMN_NAMES = [
    "other_entity_label",
    "other_dataset",
    "other_dataset_name",
    "other_dataset_id",
    "correlation",
]


def get_all_correlations(
    matrix_id, entity_label, max_per_other_dataset=100, other_dataset_ids=None,
) -> pd.DataFrame:
    """
    Find the top correlates for a given entity in one dataset with all entities in the other datasets.

    Given matrix_id and entity_label
    If other_dataset_ids is not provided, figure out what other datasets there are to query
    For each (entity in matrix, other dataset) combination, call _query_correlates to retrieve correlations

    :param matrix_id: Identify the data track along with entity label
    :param entity_label: Identifies the data track along with matrix_id
    :param max_per_other_dataset: The max number of correlates to return per dataset
    :param other_dataset_ids: the datasets to search
    :return: a dataframe with the columns CORRELATION_COLUMN_NAMES
    """

    df_per_dataset = []

    if other_dataset_ids is None:
        other_dataset_ids = CorrelatedDataset._find_correlated_datasets(matrix_id)

    if len(other_dataset_ids) == 0:
        return pd.DataFrame(columns=CORRELATION_COLUMN_NAMES)

    # This query ONLY works because this function is only called on datasets where we know we have computed correlations,
    # and all the datasets were we compute correlations are actual Dataset objects
    # Otherwise, NonstandardDatasets also have matrix ids, and such queries should generally be done through the interactive module instead of directly querying models
    # This code could be refactored to use matrix_id directly, if not for having to call CorrelatedDataset._get_correlation_file
    dataset_id = (
        Dataset.query.with_entities(Dataset.dataset_id)
        .filter(Dataset.matrix_id == matrix_id)
        .one()[0]
    )  # Data access details should be in interactive config: get dataset id
    entity_id_rec = (
        RowMatrixIndex.query.with_entities(RowMatrixIndex.entity_id)
        .join(Entity, RowMatrixIndex.entity)
        .filter(RowMatrixIndex.matrix_id == matrix_id, Entity.label == entity_label)
        .one_or_none()
    )  # Data access details should be in interactive config: get entity id
    if entity_id_rec is None:
        return pd.DataFrame(columns=CORRELATION_COLUMN_NAMES)
    entity_id = entity_id_rec[0]

    for other_dataset_id in other_dataset_ids:
        other_dataset = Dataset.get_dataset_by_id(other_dataset_id)

        # print("searching", other_dataset.display_name)
        correlates = _query_correlates(
            entity_id, dataset_id, other_dataset_id, max_per_other_dataset
        )

        df = pd.DataFrame(
            dict(
                other_entity_label=[x.entity_label for x in correlates],
                other_dataset=other_dataset.display_name,
                other_dataset_name=other_dataset.name,
                other_dataset_id=other_dataset_id,
                correlation=[x.cor for x in correlates],
                # abs_correlation=[abs(x.cor) for x in correlates],
            ),
            columns=CORRELATION_COLUMN_NAMES,
        )

        df_per_dataset.append(df)

    if len(df_per_dataset) == 0:
        return pd.DataFrame(columns=CORRELATION_COLUMN_NAMES)

    df = pd.concat(df_per_dataset).sort_values(
        by=["correlation"], key=abs, ascending=False
    )

    return df


def _query_correlates(
    entity_id: int, dataset_id: int, other_dataset_id: int, limit: int
) -> List[EntityWithCorrelation]:
    """
    To avoid storing additional indices and having to load correlations during the database load process, correlation
    are stored as separate correlation databases (sqlite files) generated from the pipeline.
    In these separate databases, we store the index of entities in their matrix
    The correlation table in these separate databases can thus be looked up using the index of an entity in its normal matrix.

    The general process is:
       1) Identify the sqlite file to query
       2) Fine index of the entity in the dataset (_get_index_from_entity_id)
       3) Query the separate correlation database for top correlates (_find_top_correlates_from_file)
       4) For each correlation row, the value of the other dim_ column is the index of the entity and the other dataset. Use this to look up the entity for that row (_bulk_get_entity_id_from_index)
    """
    cor_file_rec = CorrelatedDataset._get_correlation_file(dataset_id, other_dataset_id)
    if cor_file_rec is None:
        return []

    cor_filename, axis = cor_file_rec

    cor_filename = os.path.join(current_app.config["WEBAPP_DATA_DIR"], cor_filename)

    # map entity to index
    entity_index = _get_index_from_entity_id(dataset_id, entity_id)

    # get top correlates using indicies
    cors = _find_top_correlates_from_file(cor_filename, entity_index, limit, axis)

    # map indicies back to entities
    other_entity_ids = _bulk_get_entity_id_from_index(
        other_dataset_id, [c.index for c in cors]
    )
    return [
        EntityWithCorrelation(entity_id=entity[0], entity_label=entity[1], cor=c.cor)
        for entity, c in zip(other_entity_ids, cors)
        if entity is not None
    ]


def _find_top_correlates_from_file(file: str, index: int, limit: int, axis: SearchAxis):
    """
    This function searches an external SQLite database which contains correlations for the top N correlations.

    The correlations are stored outside of the main DB because they are so large that they dwarf all the other data
    and it takes a significant amount of time to load them into the DB. Since we can have the pre-processing pipeline
    generate a file we can search directly, we keep the correlations stored in their one files. (One file per pair of datasets
    which were correlated)

    This correlation sqlite file contains a correlation table with the columns dim_0, dim_1 and cor. The first two columns refer to the index into
    the HDF5 files that these correlations were computed for.

    :param file: The name of the file which contains the pre-calculated correlations
    :param index: the row or column of the correlation matrix to search. (Can also be thought of as
        the row index into either hdf5 files which were correlated)
    :param limit: the max number of correlates to return
    :param axis: which axis to search for the top correlates (that is to say, which hdf5 file
            does index refer to. If the hdf5 file was correlated against itself then axis should be both_dim because
            we only store unique entity pairs in the correlation db)
    :return:
    """
    conn = sqlite3.connect(file)
    c = conn.cursor()
    try:
        # Storing correlations in a dict since correlations against itself will produce duplicates in matrix
        # Initially, this was a set but it runs into the problem that the since the values are large, the
        # computed correlation values for e.g. (row: 1, col: 2) and (row: 2, col: 1) is not exact due to rounding
        # therefore even when index is same, IndexWithCorrelation(index, cor) was registered as 2 different unique values
        cor_recs = dict()

        def update_with_query(dim_column, other_dim_column, exclude_diagonal=False):
            for direction in ["asc", "desc"]:
                if exclude_diagonal:
                    filter_clause = f"{dim_column} = ? and dim_0 <> dim_1"
                else:
                    filter_clause = f"{dim_column} = ?"
                query = f"select {other_dim_column}, cor from correlation where {filter_clause} order by cor {direction} limit {limit}"
                c.execute(query, [index])
                # print("query", query, index)
                for _index, cor in c.fetchall():
                    cor_recs[_index] = IndexWithCorrelation(_index, cor)

        if axis == SearchAxis.dim_0:
            update_with_query("dim_0", "dim_1")
        elif axis == SearchAxis.dim_1:
            update_with_query("dim_1", "dim_0")
        else:
            assert axis == SearchAxis.both_dim
            # the case where both axes are the same dataset
            update_with_query("dim_1", "dim_0", exclude_diagonal=True)
            update_with_query("dim_0", "dim_1", exclude_diagonal=True)

    finally:
        c.close()
        conn.close()

    cor_recs_l = list(cor_recs.values())
    cor_recs_l.sort(key=lambda x: -abs(x.cor))
    return cor_recs_l[:limit]


def _bulk_get_entity_id_from_index(
    dataset_id: int, indices: List[int]
) -> List[Optional[Tuple[int, str]]]:
    """Given some row indices in an HDF5 file, look up which entities they correspond to."""

    rows = (
        RowMatrixIndex.query.join(Matrix, RowMatrixIndex.matrix)
        .join(Dataset, Matrix.dataset)
        .join(Entity, RowMatrixIndex.entity)
        .filter(Dataset.dataset_id == dataset_id)
        .filter(RowMatrixIndex.index.in_(indices))  # type: ignore
        .with_entities(RowMatrixIndex.index, Entity.entity_id, Entity.label)
        .all()  # Data access details should be in interactive config
    )
    mapping = {index: (entity_id, label) for index, entity_id, label in rows}
    return [mapping.get(x) for x in indices]


def _get_index_from_entity_id(dataset_id: int, entity_id: int) -> int:
    row = (
        RowMatrixIndex.query.join(
            Dataset, RowMatrixIndex.matrix_id == Dataset.matrix_id
        )
        .filter(Dataset.dataset_id == dataset_id)
        .filter(RowMatrixIndex.entity_id == entity_id)
        .one()  # Data access details should be in interactive config
    )
    return row.index
