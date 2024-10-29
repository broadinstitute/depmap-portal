import logging
from typing import Any, Optional

from breadbox.crud import dataset as dataset_crud
from breadbox.crud import types as types_crud
from breadbox.db.session import SessionWithUser
from breadbox.schemas.custom_http_exception import ResourceNotFoundError
from breadbox.models.dataset import (
    Dataset,
    MatrixDataset,
)

from depmap_compute.slice import SliceQuery

log = logging.getLogger(__name__)


def get_matrix_dataset_feature_annotations(
    db: SessionWithUser, user: str, dataset: MatrixDataset, metadata_col_name: str,
) -> dict[str, Any]:
    """
    For the given dataset, load metadata of the specified type, keyed by given id.
    If there is no metadata of this type, return an empty dictionary.
    """
    if dataset.feature_type is None or dataset.feature_type.dataset_id is None:
        return {}

    full_metadata_col = types_crud.get_dimension_type_metadata_col(
        db, dimension_type_name=dataset.feature_type, col_name=metadata_col_name
    )
    # Filter the metadata to only include the given IDs belonging to this dataset
    dataset_features = dataset_crud.get_dataset_features(db, dataset, user=db.user)
    dataset_given_ids = [feature.given_id for feature in dataset_features]
    return {given_id: full_metadata_col[given_id] for given_id in dataset_given_ids}


def get_matrix_dataset_sample_annotations(
    db: SessionWithUser, user: str, dataset: MatrixDataset, metadata_col_name: str,
) -> dict[str, Any]:
    """
    For the given dataset, load metadata of the specified type, keyed by given id.
    If there is no metadata of this type, return an empty dictionary.
    """
    full_metadata_col = types_crud.get_dimension_type_metadata_col(
        db, dimension_type_name=dataset.sample_type, col_name=metadata_col_name
    )
    # Filter the metadata to only include the given IDs belonging to this dataset
    dataset_samples = dataset_crud.get_dataset_samples(db, dataset, user=db.user)
    dataset_given_ids = [sample.given_id for sample in dataset_samples]
    return {given_id: full_metadata_col[given_id] for given_id in dataset_given_ids}


def get_dataset_feature_labels_by_id(
    db: SessionWithUser, user: str, dataset: Dataset,
) -> dict[str, str]:
    """
    Try loading feature labels from metadata. 
    If there is no metadata, then just return the given IDs as labels.
    """
    metadata_labels_by_given_id = get_matrix_dataset_feature_annotations(
        db=db, user=user, dataset=dataset, metadata_col_name="label"
    )

    if metadata_labels_by_given_id:
        return metadata_labels_by_given_id
    else:
        all_dataset_features = dataset_crud.get_dataset_features(
            db=db, dataset=dataset, user=user
        )
        return {feature.given_id: feature.given_id for feature in all_dataset_features}


def get_dataset_sample_labels_by_id(
    db: SessionWithUser, user: str, dataset: Dataset,
) -> dict[str, str]:
    """
    Try loading sample labels from metadata.
    If there is no metadata, then just return the given IDs as labels.
    """
    metadata_labels = get_matrix_dataset_sample_annotations(
        db=db, user=user, dataset=dataset, metadata_col_name="label"
    )
    if metadata_labels:
        return metadata_labels
    else:
        samples = dataset_crud.get_dataset_samples(db=db, dataset=dataset, user=user)
        return {sample.given_id: sample.given_id for sample in samples}


def get_tabular_dataset_labels_by_id(
    db: SessionWithUser, dataset: Dataset,
) -> dict[str, str]:
    """
    For the index (rows) of a tabular dataset, try loading labels from metadata.
    If there are no labels in the metadata or there is no metadata, then just return the given IDs as labels.
    """
    raise NotImplementedError()


def get_labels_for_slice_type(
    db: SessionWithUser, slice_query: SliceQuery
) -> Optional[dict[str, str]]:
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
    elif slice_query.identifier == "column":
        # TODO: return the labels for the tabular dataset index
        return None
