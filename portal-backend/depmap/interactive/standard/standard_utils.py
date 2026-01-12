"""
Utils for standard axes datasets
Non-axes datasets are handled in interactive_utils
"""
from depmap.interactive.common_utils import (
    RowSummary,
)
from depmap.interactive.config.utils import (
    get_matrix_id,
    is_transpose,
)
from depmap.database import db
from depmap.entity.models import Entity
from depmap.partials.matrix.models import Matrix, RowMatrixIndex, ColMatrixIndex


def get_matrix(dataset_id):
    return Matrix.get_by_id(get_matrix_id(dataset_id))


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
