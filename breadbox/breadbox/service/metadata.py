import logging
from typing import Any, Optional

from breadbox.crud import dataset as dataset_crud
from breadbox.crud import dimension_types as types_crud
from breadbox.db.session import SessionWithUser
from breadbox.schemas.custom_http_exception import ResourceNotFoundError
from breadbox.models.dataset import (
    DatasetFeature,
    DatasetSample,
    Dataset, 
    MatrixDataset,
    TabularDataset,
    DimensionType,
)

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


def get_matrix_dataset_feature_labels_by_id(
    db: SessionWithUser, user: str, dataset: MatrixDataset,
) -> dict[str, str]:
    """
    Try loading feature labels from metadata.
    If there are no labels in the metadata or there is no metadata, then just return the feature names.
    """
    if dataset.feature_type_name is not None:
        dimension_type = types_crud.get_dimension_type(db=db, name=dataset.feature_type_name)
        metadata_labels_by_given_id = dataset_crud.get_metadata_used_in_matrix_dataset(
            db=db, 
            dimension_type=dimension_type, 
            matrix_dataset=dataset, 
            dimension_subtype_cls=DatasetFeature,
            metadata_col_name="label",
        )
        if metadata_labels_by_given_id:
            return metadata_labels_by_given_id

    # If there are no labels or there is no feature type, return the given IDs
    feature_given_ids = dataset_crud.get_matrix_dataset_given_ids(db, dataset, axis="feature")
    return {given_id: given_id for given_id in feature_given_ids}


def get_matrix_dataset_sample_labels_by_id(
    db: SessionWithUser, user: str, dataset: MatrixDataset,
) -> dict[str, str]:
    """
    Try loading sample labels from metadata.
    If there are no labels in the metadata or there is no metadata, then just return the sample names.
    """
    
    dimension_type = types_crud.get_dimension_type(db=db, name=dataset.sample_type_name)
    metadata_labels_by_given_id = dataset_crud.get_metadata_used_in_matrix_dataset(
        db=db, 
        dimension_type=dimension_type, 
        matrix_dataset=dataset, 
        dimension_subtype_cls=DatasetSample,
        metadata_col_name="label",
    )
    if metadata_labels_by_given_id:
        return metadata_labels_by_given_id
    else:
        sample_given_ids = dataset_crud.get_matrix_dataset_given_ids(db=db, dataset=dataset, axis="sample")
        return {given_id: given_id for given_id in sample_given_ids}


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
        return get_matrix_dataset_sample_labels_by_id(db, db.user, dataset)
    elif slice_query.identifier_type in {"sample_label", "sample_id"}:
        return get_matrix_dataset_feature_labels_by_id(db, db.user, dataset)
    elif slice_query.identifier_type == "column":
        return get_tabular_dataset_labels_by_id(db, dataset)
    else:
        raise ResourceNotFoundError(
            f"Unknown identifier type: '{slice_query.identifier_type}'"
        )


def get_dataset_feature_label_by_id(
    db: SessionWithUser, dataset: MatrixDataset, given_id: str
):
    """Looks up a single label for a given_id in a dataset. Internally this is implemented inefficiently so only
    call this if you really want a single label. If you want to loop through many IDs, use get_matrix_dataset_sample_labels_by_id instead
    (or we rewrite this function to make a DB query to fetch only the data we actually need)
    """
    labels = get_matrix_dataset_feature_labels_by_id(db, db.user, dataset)
    return labels.get(given_id)


def get_dataset_sample_label_by_id(
    db: SessionWithUser, dataset: MatrixDataset, given_id: str
):
    """Looks up a single label for a given_id in a dataset. Internally this is implemented inefficiently so only
    call this if you really want a single label. If you want to loop through many IDs, use get_matrix_dataset_sample_labels_by_id instead
    (or we rewrite this function to make a DB query to fetch only the data we actually need)
    """
    labels = get_matrix_dataset_sample_labels_by_id(db, db.user, dataset)
    return labels.get(given_id)


def get_dataset_feature_by_label(
    db: SessionWithUser, dataset_id: str, feature_label: str
) -> DatasetFeature:
    """Load the dataset feature corresponding to the given dataset ID and feature label"""

    dataset = dataset_crud.get_dataset(db, db.user, dataset_id)
    if dataset is None:
        raise ResourceNotFoundError(f"Dataset '{dataset_id}' not found.")
    assert isinstance(dataset, MatrixDataset)

    labels_by_given_id = get_matrix_dataset_feature_labels_by_id(db, db.user, dataset)
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

    labels_by_given_id = get_matrix_dataset_sample_labels_by_id(db, db.user, dataset)
    given_ids_by_label = {label: id for id, label in labels_by_given_id.items()}
    sample_given_id = given_ids_by_label.get(sample_label)
    if sample_given_id is None:
        raise ResourceNotFoundError(
            f"Sample label '{sample_label}' not found in dataset '{dataset_id}'."
        )

    return dataset_crud.get_dataset_sample_by_given_id(db, dataset_id, sample_given_id)


def get_dimension_indexes_of_labels(
    db: SessionWithUser,
    user: str,
    dataset: MatrixDataset,
    axis: str,
    dimension_labels: list[str],
) -> tuple[list[int], list[str]]:
    """
    Get the set of numeric indices corresponding to the given dimension labels for the given dataset.
    Note: The order of the result does not necessarily match the order of the input
    """

    # We could do this in one query, but it's unwieldy, so let's make two queries. First
    # let's resolve dimension_labels to given_ids
    if axis == "feature":
        all_given_ids_to_labels = get_matrix_dataset_feature_labels_by_id(
            db, user, dataset
        )
    else:
        assert axis == "sample"
        all_given_ids_to_labels = get_matrix_dataset_sample_labels_by_id(
            db, user, dataset
        )
    filtered_given_ids_to_labels = {
        id: label
        for id, label in all_given_ids_to_labels.items()
        if label in dimension_labels
    }
    missing_labels = set(dimension_labels).difference(
        filtered_given_ids_to_labels.values()
    )

    # for the time being, just warn in the log about things that are missing. I'm not 100% confident that
    # something won't break if we start treating missing things as an error. If we don't see warnings in the
    # log from normal use, we can turn it into an error later
    if len(missing_labels) > 0:
        log.warning(
            f"In get_dimension_indexes_of_labels, missing labels: {missing_labels}"
        )

    # now resolve those given_ids to indices
    if axis == "feature":
        indices, missing_given_ids = dataset_crud.get_feature_indexes_by_given_ids(
            db, user, dataset, list(filtered_given_ids_to_labels.keys())
        )
    else:
        assert axis == "sample"
        indices, missing_given_ids = dataset_crud.get_sample_indexes_by_given_ids(
            db, user, dataset, list(filtered_given_ids_to_labels.keys())
        )

    if len(missing_given_ids) > 0:
        log.warning(
            f"In get_dimension_indexes_of_labels, missing given_ids: {missing_given_ids}"
        )

    return indices, list(missing_labels)


def get_dimension_type_identifiers(
    db: SessionWithUser,
    dimension_type: DimensionType,
    filter_by_dataset_ids: Optional[list[str]],
    limit: Optional[int] = None,
):
    """
    For the given dimension type, get all given IDs and labels.
    If no dataset IDs are provided as a filter, all given IDs and labels will be returned, 
    regardless of whether they are used in any dataset. 
    """
    # Get all dimension identifiers in a dimension type
    dim_type_ids_and_labels = types_crud.get_dimension_type_labels_by_id(
        db, dimension_type.name, limit=limit,
    )

    if filter_by_dataset_ids is None:
        return dim_type_ids_and_labels

    # Get all dimension given ids from list of filtered datasets
    unique_dimension_given_ids = dataset_crud.get_unique_dimension_ids_from_datasets(
        db, filter_by_dataset_ids, dimension_type
    )

    # Further filters only dimensions that have identifiers that exist in the metadata
    return {
        given_id: dim_type_ids_and_labels[given_id]
        for given_id in unique_dimension_given_ids
        if given_id in dim_type_ids_and_labels
    }
