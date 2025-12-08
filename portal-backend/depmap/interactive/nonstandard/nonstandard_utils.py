import itertools
import flask
import pandas as pd
import sqlalchemy as sa

from typing import List, Dict, Tuple, Iterable

from depmap.database import db
from depmap.interactive.common_utils import (
    RowSummary,
    format_features_from_value,
    format_features_from_label_aliases,
)
from depmap.interactive.config.utils import (
    get_entity_class,
    is_prepopulate,
    is_transpose,
    get_entity_type,
)
from depmap.interactive.nonstandard.models import (
    NonstandardMatrix,
    RowNonstandardMatrix,
    ColNonstandardMatrix,
)
from depmap.cell_line.models import CellLine
from depmap.partials.matrix.models import CellLineSeries
from depmap.gene.models import Gene
from depmap.proteomics.models import Protein
from depmap.global_search.models import GlobalSearchIndex
from depmap.utilities.hdf5_utils import open_hdf5_file
from depmap.entity.models import Entity


def get_matrix(dataset_id):
    return NonstandardMatrix.get(dataset_id)


def get_matching_rows(dataset, prefix, max=1000000):
    assert not is_prepopulate(
        dataset
    ), "Attempt to get matching features for {} despite configuration to initially prepopulate all options.".format(
        dataset
    )

    if get_entity_class(dataset) is not None:
        label_aliases_list = _get_label_aliases_starting_with(dataset, prefix, max)
        features = format_features_from_label_aliases(label_aliases_list)  # fixme
    else:
        values = get_rows_starting_with(dataset, prefix, max)
        features = format_features_from_value(values)

    return features


def get_matching_row_entity_ids(dataset_id, prefix, max=10) -> Iterable[int]:
    assert get_entity_type(dataset_id) is not None
    entity_ids = _find_entity_ids_by_label_alias_prefix(dataset_id, prefix, max)
    return entity_ids


def _get_label_aliases_starting_with(dataset_id, prefix, max=10):
    """
    Different function than get_row_starting_with because this returns a list of entity label, entity aliases tuples
    :return: Appropriately sorted list of entity label, [entity aliases] tuples with labels or aliases that start with prefix, up to max number of matches
    """
    entity_ids = _find_entity_ids_by_label_alias_prefix(dataset_id, prefix, max)

    entity_class = get_entity_class(dataset_id)
    assert entity_class is not None
    list_of_label_aliases = []
    for entity_id in entity_ids:
        # calling on the entity_class enforces that we only get objects of the correct entity subclass
        list_of_label_aliases.append(entity_class.get_label_aliases(entity_id))

    return list_of_label_aliases


def _find_entity_ids_by_label_alias_prefix(dataset_id, prefix, max=10) -> Iterable[int]:
    # enforce_cache_row_col_names(dataset_id)
    entity_class = get_entity_class(dataset_id)
    if entity_class == Gene:
        generator = _find_gene_ids_by_label_alias_prefix(dataset_id, prefix)
    elif entity_class == Protein:
        generator = _find_protein_ids_by_label_alias_prefix(dataset_id, prefix)
    else:
        # To implement a generic entity label search, _find_entities_by_label_prefix in standard_utils.py is an example (but for standard datasets)
        raise NotImplementedError(
            "Attempt to search entities for dataset {} with unimplemented entity_class {}. ".format(
                dataset_id, entity_class
            )
        )

    entity_ids = itertools.islice(generator, max)
    return entity_ids


def _find_gene_ids_by_label_alias_prefix(dataset_id, prefix):
    """
    # sqlite appears to not handle the "OR" subquery well, so execute two queries and compute the union ourselves
    Need to put symbol and alias on equal footing, so that order_by orders with exact matches first whether the exact match is a symbol or alias
    entity_ids_seen prevents a entity from being yielded twice
    """
    indices = (
        GlobalSearchIndex.query.join(
            RowNonstandardMatrix,
            RowNonstandardMatrix.entity_id == GlobalSearchIndex.entity_id,
        )
        .join(NonstandardMatrix)
        .filter(
            (GlobalSearchIndex.type == "gene")
            | (GlobalSearchIndex.type == "gene_alias"),
            GlobalSearchIndex.label.startswith(prefix),
            NonstandardMatrix.nonstandard_dataset_id == dataset_id,
        )
        .order_by(GlobalSearchIndex.label)
    )

    gene_ids_seen = set()

    for index in indices:
        gene_id = index.entity_id
        if gene_id not in gene_ids_seen:
            gene_ids_seen.add(gene_id)
            yield gene_id


def _find_protein_ids_by_label_alias_prefix(dataset_id, prefix):
    indices = (
        Protein.query.filter(
            sa.or_(
                Protein.label.startswith(prefix), Protein.uniprot_id.startswith(prefix)
            )
        )
    ).order_by(Protein.label)

    protein_ids_seen = set()

    for index in indices:
        protein_id = index.entity_id
        if protein_id not in protein_ids_seen:
            protein_ids_seen.add(protein_id)
            yield protein_id


def get_rows_starting_with(dataset_id, prefix, max=10):
    """
    :return: Appropriately sorted list of row names in dataset_id that start with prefix, up to max number of matches
    """
    # enforce_cache_row_col_names(dataset_id)

    entity_class = get_entity_class(dataset_id)
    assert (
        entity_class is None
    ), "Attempt to directly search row names for dataset {} which has entity set".format(
        dataset_id
    )
    dataset_row_indices = (
        RowNonstandardMatrix.query.join(NonstandardMatrix)
        .filter(
            NonstandardMatrix.nonstandard_dataset_id == dataset_id,
            RowNonstandardMatrix.row_name.startswith(prefix),
        )
        # we sort and take limit in the query, to short circuit and avoid the database access control check for every additional row retrieved
        .order_by(RowNonstandardMatrix.row_name)
        .limit(max)
        .all()
    )
    row_names = [row_index.row_name for row_index in dataset_row_indices]
    return row_names


def valid_row(dataset_id, row_name):
    """
    :return: Boolean whether row_name is a valid row in dataset with dataset_id
    """
    # enforce_cache_row_col_names(dataset_id)
    entity_class = get_entity_class(dataset_id)
    if entity_class is None:
        return db.session.query(
            RowNonstandardMatrix.query.join(NonstandardMatrix)
            .filter(
                NonstandardMatrix.nonstandard_dataset_id == dataset_id,
                RowNonstandardMatrix.row_name == row_name,
            )
            .exists()
        ).scalar()
    else:
        # entity_id = entity_class.get_entity_id_from_label(row_name)
        entity_id = entity_class.get_by_label(row_name, must=True).entity_id
        return db.session.query(
            RowNonstandardMatrix.query.join(NonstandardMatrix)
            .filter(
                NonstandardMatrix.nonstandard_dataset_id == dataset_id,
                RowNonstandardMatrix.entity_id == entity_id,
            )
            .exists()
        ).scalar()


def get_row_of_values(dataset_id, feature):
    """
    Returns pandas series of that row slice, indexed by column name.
    Returning a series instead of a dataframe so that the function that calls this (which is more specific and knows about x and y) can name the column uniquely.
    """
    # enforce_cache_row_col_names(dataset_id)
    entity_class = get_entity_class(dataset_id)
    nonstandard_matrix = NonstandardMatrix.query.filter(
        NonstandardMatrix.nonstandard_dataset_id == dataset_id
    ).one()

    if entity_class is None:
        row_index = (
            nonstandard_matrix.row_index.filter(
                RowNonstandardMatrix.row_name == feature
            )
            .one()
            .index
        )
    else:
        # must=True since we only reach here if it passes valid_row
        feature_entity_id = entity_class.get_by_label(feature, must=True).entity_id
        row_index = (
            nonstandard_matrix.row_index.filter(
                RowNonstandardMatrix.entity_id == feature_entity_id
            )
            .one()
            .index
        )

    # this stuff is uses for plotting custom datasets from csv files
    # hdf5_id, hdf5_id_type = get_hdf5_id(dataset_id)
    source_dir = flask.current_app.config["NONSTANDARD_DATA_DIR"]
    col_names, indices = get_all_col_names_indices(dataset_id)
    with open_hdf5_file(source_dir, nonstandard_matrix.file_path) as f:
        if is_transpose(dataset_id):
            values = list(f["data"][indices, row_index])
        else:
            values = list(f["data"][row_index, indices])
        series = pd.Series(values, col_names)
        return CellLineSeries(series)


_all_col_names_cache: Dict[
    str, Tuple[List[str], List[int]]
] = {}  # possible memory leak source


def get_all_row_indices_labels_entity_ids(dataset_id):
    """
    Gets a list of RowSummary objects: including the index, entity ID, and label for each row.
    """
    entity_class = get_entity_class(dataset_id)
    query = NonstandardMatrix.query.filter(
        NonstandardMatrix.nonstandard_dataset_id == dataset_id
    ).join(RowNonstandardMatrix)

    if entity_class is None:
        query = query.with_entities(
            RowNonstandardMatrix.index,
            RowNonstandardMatrix.entity_id,
            RowNonstandardMatrix.row_name,
        )
    else:
        query = query.join(Entity).with_entities(
            RowNonstandardMatrix.index, RowNonstandardMatrix.entity_id, Entity.label
        )

    return [RowSummary(*x) for x in query.all()]


def get_dataset_sample_ids(dataset_id: str) -> list[str]:
    return [
        row[0]
        for row in NonstandardMatrix.query.filter_by(nonstandard_dataset_id=dataset_id)
        .join(ColNonstandardMatrix)
        .with_entities(ColNonstandardMatrix.depmap_id)
        .all()
    ]


def get_subsetted_df(dataset_id, row_indices, col_indices):
    transpose = is_transpose(dataset_id)
    matrix = NonstandardMatrix.get(dataset_id)
    df = matrix.get_subsetted_df(row_indices, col_indices, transpose)
    return df


def get_all_col_names_indices(dataset_id):
    """
    ORDERED BY INDEX
    Unlike get_all_row_names, this should be regularly used
    Returns column names of dataset, used in get_row_of_values
    """
    if dataset_id in _all_col_names_cache:
        depmap_ids_indices = _all_col_names_cache[dataset_id]
    else:
        # h5py requires indices to be in increasing order
        # See tests/depmap/interactive/interactive_utils/test_get_and_process_data.py::test_get_row_of_values
        col_list_of_sqalch_results = (
            ColNonstandardMatrix.query.join(NonstandardMatrix)
            .filter(NonstandardMatrix.nonstandard_dataset_id == dataset_id)
            .order_by("index")
            .with_entities(ColNonstandardMatrix.depmap_id, ColNonstandardMatrix.index)
            .all()
        )
        # unzip to create a list of two long tuples [(...labels), (...indices)]
        depmap_ids = []
        indices = []
        for depmap_id, index in col_list_of_sqalch_results:
            depmap_ids.append(depmap_id)
            indices.append(
                index
            )  # this is just cleaner than whatever clever syntax I could come up with, esp. because the sqlalchemy collections result cannot be unzipped like a tuple
        depmap_ids_indices = (depmap_ids, indices)
        _all_col_names_cache[dataset_id] = depmap_ids_indices
    return depmap_ids_indices
