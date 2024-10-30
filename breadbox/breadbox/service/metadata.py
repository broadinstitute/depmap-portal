import logging
from typing import Any, Optional

from breadbox.crud import dataset as dataset_crud
from breadbox.crud import types as types_crud
from breadbox.db.session import SessionWithUser
from breadbox.schemas.custom_http_exception import ResourceNotFoundError
from breadbox.models.dataset import MatrixDataset, TabularDataset

from depmap_compute.slice import SliceQuery

log = logging.getLogger(__name__)


def get_tabular_dataset_metadata_annotations(
    db: SessionWithUser, dataset: MatrixDataset, metadata_col_name: str,
) -> dict[str, Any]:
    """
    For the given tabular dataset, load a column from the associated metadata.
    Return a dictionary of values keyed by given id.
    Note: this should work regardless of whether or not the given dataset IS metadata
    or HAS metadata.
    """
    full_metadata_col = types_crud.get_dimension_type_metadata_col(
        db, dimension_type_name=dataset.sample_type, col_name=metadata_col_name
    )
    # Filter the metadata to only include the given IDs belonging to this dataset
    dataset_samples = dataset_crud.get_dataset_columns(db, dataset)
    dataset_given_ids = [sample.given_id for sample in dataset_samples]
    return {given_id: full_metadata_col[given_id] for given_id in dataset_given_ids}


def get_tabular_dataset_labels_by_id(
    db: SessionWithUser, dataset: TabularDataset,
) -> dict[str, str]:
    """
    For the index (rows) of a tabular dataset, try loading labels from metadata.
    If there are no labels in the metadata or there is no metadata, then just return the given IDs as labels.
    """
    metadata_labels = get_tabular_dataset_metadata_annotations(
        db=db, dataset=dataset, metadata_col_name="label"
    )
    if metadata_labels:
        return metadata_labels
    else:
        columns = dataset_crud.get_dataset_columns(db=db, dataset=dataset)
        return {column.given_id: column.given_id for column in columns}


def get_labels_for_slice_type(
    db: SessionWithUser, slice_query: SliceQuery
) -> dict[str, str]:
    """
    For the given slice query identifier type, get a dictionary of all the dataset labels and IDs
    that should be used to index the resulting slice.
    If the identifier type does not have labels, return None.
    """
    dataset = dataset_crud.get_dataset(db, db.user, slice_query.dataset_id)
    if dataset is None:
        raise ResourceNotFoundError(f"Dataset '{slice_query.dataset_id}' not found.")

    if slice_query.identifier_type in {"feature_label", "feature_id"}:
        return dataset_crud.get_dataset_sample_labels_by_id(db, db.user, dataset)
    elif slice_query.identifier_type in {"sample_label", "sample_id"}:
        return dataset_crud.get_dataset_feature_labels_by_id(db, db.user, dataset)
    elif slice_query.identifier_type == "column":
        return get_tabular_dataset_labels_by_id(db, dataset)
    else:
        raise ResourceNotFoundError(
            f"Unknown identifier type: '{slice_query.identifier_type}'"
        )
