import logging
from typing import Any

from breadbox.crud import dataset as dataset_crud
from breadbox.crud import types as types_crud
from breadbox.db.session import SessionWithUser
from breadbox.schemas.custom_http_exception import ResourceNotFoundError
from breadbox.models.dataset import (
    DatasetFeature,
    DatasetSample,
    MatrixDataset,
    TabularDataset,
)
from breadbox.service import metadata as metadata_service

from depmap_compute.slice import SliceQuery

log = logging.getLogger(__name__)


def get_tabular_dataset_metadata_annotations(
    db: SessionWithUser, dataset: TabularDataset, metadata_col_name: str,
) -> dict[str, Any]:
    """
    For the given tabular dataset, load a column from the associated metadata.
    Return a dictionary of values keyed by given id.
    Note: this should work regardless of whether or not the given dataset IS metadata
    or HAS metadata.
    """
    full_metadata_col = types_crud.get_dimension_type_metadata_col(
        db, dimension_type_name=dataset.index_type_name, col_name=metadata_col_name
    )
    # Filter the metadata to only include the given IDs belonging to this dataset
    dataset_index_given_ids = dataset_crud.get_tabular_dataset_index_given_ids(
        db, dataset
    )
    filtered_metadata_vals = {}
    for given_id in dataset_index_given_ids:
        metadata_val = full_metadata_col.get(given_id)
        if metadata_val is not None:
            filtered_metadata_vals[given_id] = metadata_val
    return filtered_metadata_vals


def get_matrix_dataset_feature_metadata(
    db: SessionWithUser, dataset: MatrixDataset, metadata_col_name: str,
) -> dict[str, Any]:
    """
    For the given matrix dataset, load a column from the associated metadata.
    The result will only include given ids which exist in both the dataset and the metadata.
    """
    full_metadata_col = types_crud.get_dimension_type_metadata_col(
        db, dimension_type_name=dataset.feature_type_name, col_name=metadata_col_name
    )
    # Filter the metadata to only include the given IDs belonging to this dataset
    dataset_features = dataset_crud.get_dataset_features(db, dataset)
    filtered_metadata_vals = {}
    for feature in dataset_features:
        metadata_val = full_metadata_col.get(feature.given_id)
        if metadata_val is not None:
            filtered_metadata_vals[feature.given_id] = metadata_val
    return filtered_metadata_vals


def get_matrix_dataset_sample_metadata(
    db: SessionWithUser, dataset: MatrixDataset, metadata_col_name: str,
) -> dict[str, Any]:
    """
    For the given matrix dataset, load a column from the associated metadata.
    The result will only include given ids which exist in both the dataset and the metadata.
    """
    full_metadata_col = types_crud.get_dimension_type_metadata_col(
        db, dimension_type_name=dataset.sample_type_name, col_name=metadata_col_name
    )
    # Filter the metadata to only include the given IDs belonging to this dataset
    dataset_samples = dataset_crud.get_dataset_samples(db, dataset)
    filtered_metadata_vals = {}
    for sample in dataset_samples:
        metadata_val = full_metadata_col.get(sample.given_id)
        if metadata_val is not None:
            filtered_metadata_vals[sample.given_id] = metadata_val
    return filtered_metadata_vals


def get_dataset_feature_labels_by_id(
    db: SessionWithUser, user: str, dataset: MatrixDataset,
) -> dict[str, str]:
    """
    Try loading feature labels from metadata.
    If there are no labels in the metadata or there is no metadata, then just return the feature names.
    """
    metadata_labels_by_given_id = get_matrix_dataset_feature_metadata(
        db=db, dataset=dataset, metadata_col_name="label"
    )

    if metadata_labels_by_given_id:
        return metadata_labels_by_given_id
    else:
        all_dataset_features = dataset_crud.get_dataset_features(db, dataset)
        return {feature.given_id: feature.given_id for feature in all_dataset_features}


def get_dataset_sample_labels_by_id(
    db: SessionWithUser, user: str, dataset: MatrixDataset,
) -> dict[str, str]:
    """
    Try loading sample labels from metadata.
    If there are no labels in the metadata or there is no metadata, then just return the sample names.
    """
    metadata_labels = get_matrix_dataset_sample_metadata(
        db=db, dataset=dataset, metadata_col_name="label"
    )
    if metadata_labels:
        return metadata_labels
    else:
        samples = dataset_crud.get_dataset_samples(db=db, dataset=dataset)
        return {sample.given_id: sample.given_id for sample in samples}


def get_tabular_dataset_labels_by_id(
    db: SessionWithUser, dataset: TabularDataset,
) -> dict[str, str]:
    """
    For the index (rows) of a tabular dataset, load the relevant labels from metadata.
    This should only include the labels that overlap between the dataset and its metadata.
    If there are no labels in the metadata or there is no metadata, then just return the given IDs as labels.
    """
    metadata_labels = get_tabular_dataset_metadata_annotations(
        db=db, dataset=dataset, metadata_col_name="label"
    )
    if metadata_labels:
        return metadata_labels
    else:
        dataset_index_given_ids = dataset_crud.get_tabular_dataset_index_given_ids(
            db, dataset
        )
        return {given_id: given_id for given_id in dataset_index_given_ids}


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
        return metadata_service.get_dataset_sample_labels_by_id(db, db.user, dataset)
    elif slice_query.identifier_type in {"sample_label", "sample_id"}:
        return metadata_service.get_dataset_feature_labels_by_id(db, db.user, dataset)
    elif slice_query.identifier_type == "column":
        return get_tabular_dataset_labels_by_id(db, dataset)
    else:
        raise ResourceNotFoundError(
            f"Unknown identifier type: '{slice_query.identifier_type}'"
        )


def get_dataset_feature_by_label(
    db: SessionWithUser, dataset_id: str, feature_label: str
) -> DatasetFeature:
    """Load the dataset feature corresponding to the given dataset ID and feature label"""

    dataset = dataset_crud.get_dataset(db, db.user, dataset_id)
    if dataset is None:
        raise ResourceNotFoundError(f"Dataset '{dataset_id}' not found.")
    assert isinstance(dataset, MatrixDataset)

    labels_by_given_id = metadata_service.get_dataset_feature_labels_by_id(
        db, db.user, dataset
    )
    given_ids_by_label = {label: id for id, label in labels_by_given_id.items()}
    feature_given_id = given_ids_by_label.get(feature_label)
    if feature_given_id is None:
        raise ResourceNotFoundError(
            f"Feature label '{feature_label}' not found in dataset '{dataset_id}'."
        )

    return dataset_crud.get_dataset_feature_by_given_id(
        db, dataset_id, feature_given_id
    )


def get_dataset_sample_by_label(
    db: SessionWithUser, dataset_id: str, sample_label: str
) -> DatasetSample:
    """Load the dataset sample corresponding to the given dataset ID and sample label"""

    dataset = dataset_crud.get_dataset(db, db.user, dataset_id)
    if dataset is None:
        raise ResourceNotFoundError(f"Dataset '{dataset_id}' not found.")
    assert isinstance(dataset, MatrixDataset)

    labels_by_given_id = metadata_service.get_dataset_sample_labels_by_id(
        db, db.user, dataset
    )
    given_ids_by_label = {label: id for id, label in labels_by_given_id.items()}
    sample_given_id = given_ids_by_label.get(sample_label)
    if sample_given_id is None:
        raise ResourceNotFoundError(
            f"Sample label '{sample_label}' not found in dataset '{dataset_id}'."
        )

    return dataset_crud.get_dataset_sample_by_given_id(db, dataset_id, sample_given_id)
