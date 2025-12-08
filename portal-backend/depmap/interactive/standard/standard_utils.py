"""
Utils for standard axes datasets
Non-axes datasets are handled in interactive_utils
"""
import itertools
from typing import List, Iterable
from depmap.interactive.common_utils import (
    RowSummary,
    format_features_from_value,
    format_features_from_label_aliases,
)
from depmap.interactive.config.utils import (
    get_matrix_id,
    is_transpose,
    get_entity_type,
    legacy_get_entity_class_name,
)
from depmap.database import db
from depmap.entity.models import Entity
from depmap.partials.matrix.models import Matrix, RowMatrixIndex, ColMatrixIndex
from depmap.global_search.models import GlobalSearchIndex
from depmap.utilities.entity_utils import get_entity_class_by_name


def get_matrix(dataset_id):
    return Matrix.get_by_id(get_matrix_id(dataset_id))


def get_matching_rows(dataset_id, prefix, max=10):
    """
    Return list of row names in dataset_id starting with prefix, up to max 
    """
    entity_class_name = legacy_get_entity_class_name(dataset_id)

    if _has_global_search_aliases(entity_class_name):
        # use the global search index
        label_aliases_list = _get_label_aliases_starting_with(
            dataset_id, prefix, entity_class_name
        )
        return format_features_from_label_aliases(label_aliases_list)

    else:
        # not in global search, no aliases implemented for this entity (e.g. ContextEntity, AntibodyEntity)
        # on in the case of compound, the fact that global search loads Compound and its aliases, whereas the matrix rows are CompoundExperiments
        entities = _find_entities_by_label_prefix(dataset_id, prefix, max)
        row_names = [entity.label for entity in entities]
        return format_features_from_value(row_names)


def get_matching_row_entity_ids(dataset_id, prefix, max=10) -> Iterable[int]:
    entity_type = get_entity_type(dataset_id)
    assert entity_type is not None

    if _has_global_search_aliases(entity_type):
        # use the global search index
        entity_ids = _find_entity_ids_by_label_alias_prefix(dataset_id, prefix, max)
    else:
        # not in global search, no aliases implemented for this entity (e.g. ContextEntity, AntibodyEntity)
        # on in the case of compound, the fact that global search loads Compound and its aliases, whereas the matrix rows are CompoundExperiments
        entities = _find_entities_by_label_prefix(dataset_id, prefix, max)
        entity_ids = [entity.entity_id for entity in entities]

    return entity_ids


def _has_global_search_aliases(entity_type: str) -> bool:
    return entity_type == "gene"


def _get_label_aliases_starting_with(dataset_id, prefix, entity_class_name, max=10):
    """
    Separate function for testability
    """
    entities = _find_entity_ids_by_label_alias_prefix(dataset_id, prefix, max)

    list_of_label_aliases = []
    entity_class = get_entity_class_by_name(entity_class_name)
    for entity_id in entities:
        # calling on the entity_class enforces that we only get objects of the correct entity subclass
        list_of_label_aliases.append(entity_class.get_label_aliases(entity_id))
    return list_of_label_aliases


def _find_entity_ids_by_label_alias_prefix(dataset_id, prefix, max=10) -> Iterable[int]:
    def _generator_function(dataset_id, prefix):
        """
        # the test for this is that SWI5 should appear before SOX10 for the prefix 's', since SWI5 has the alias SAE3

        # sqlite appears to not handle the "OR" subquery well, so execute two queries and compute the union ourselves
        Need to put symbol and alias on equal footing, so that order_by orders with exact matches first whether the exact match is a symbol or alias
        entity_ids_seen prevents a entity from being yielded twice
        """
        indices = (
            GlobalSearchIndex.query.join(
                RowMatrixIndex, RowMatrixIndex.entity_id == GlobalSearchIndex.entity_id
            )
            .filter(
                (GlobalSearchIndex.type == "gene")
                | (GlobalSearchIndex.type == "gene_alias"),
                GlobalSearchIndex.label.startswith(prefix),
                RowMatrixIndex.matrix_id == get_matrix_id(dataset_id),
            )
            .order_by(GlobalSearchIndex.label)
        )

        entity_ids_seen = set()

        for index in indices:
            entity_id = index.entity_id
            if entity_id not in entity_ids_seen:
                entity_ids_seen.add(entity_id)
                yield entity_id

    generator = _generator_function(dataset_id, prefix)
    entities = itertools.islice(generator, max)
    return entities


def _find_entities_by_label_prefix(dataset_id, prefix, max=10) -> List[Entity]:
    matrix_id = get_matrix_id(dataset_id)
    entities = (
        Entity.query.join(RowMatrixIndex)
        .filter(RowMatrixIndex.matrix_id == matrix_id, Entity.label.startswith(prefix))
        .all()
    )
    entities = sorted(entities, key=lambda entity: entity.label.casefold())
    return entities[:max]


def get_all_row_indices_labels_entity_ids(dataset_id):
    """
    Gets a list of RowSummary objects: including the index, entity ID, and label for each row.
    """
    matrix_id = get_matrix_id(dataset_id)
    return [
        RowSummary(*x)
        for x in Matrix.query.filter_by(matrix_id=matrix_id)
        .join(RowMatrixIndex)
        .join(Entity)
        .with_entities(RowMatrixIndex.index, Entity.entity_id, Entity.label)
        .all()
    ]


def get_dataset_sample_ids(dataset_id: str) -> list[str]:
    matrix_id = get_matrix_id(dataset_id)
    return [
        row[0]
        for row in Matrix.query.filter_by(matrix_id=matrix_id)
        .join(ColMatrixIndex)
        .with_entities(ColMatrixIndex.depmap_id)
        .all()
    ]


def get_subsetted_df(dataset_id, row_indices, col_indices):
    transpose = is_transpose(dataset_id)
    matrix = Matrix.query.get(get_matrix_id(dataset_id))
    df = matrix.get_subsetted_df(row_indices, col_indices, transpose)
    return df


def valid_row(dataset_id, row_name):
    """
    Matches only exact entity id. 
    """
    return db.session.query(
        RowMatrixIndex.query.join(Entity)
        .filter(
            RowMatrixIndex.matrix_id == get_matrix_id(dataset_id),
            Entity.label == row_name,
        )
        .exists()
    ).scalar()


def get_row_of_values(dataset_id, entity_label_or_context_name):
    """
    Returns pandas series of that row slice, indexed by column name.
    Returning a series instead of a dataframe so that the function that calls this (which is more specific and knows about x and y) can name the column uniquely.

    Series is used to filter, color, or plot values
    """
    matrix = Matrix.query.get(get_matrix_id(dataset_id))
    return matrix.get_cell_line_values_and_depmap_ids(
        entity_label_or_context_name, by_label=True
    )
