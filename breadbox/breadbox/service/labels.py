from breadbox.db.session import SessionWithUser
from breadbox.crud import dataset as dataset_crud
from breadbox.models.dataset import (
    DatasetFeature,
    DatasetSample,
    MatrixDataset,
)
from breadbox.schemas.custom_http_exception import ResourceNotFoundError


def get_dataset_feature_labels_by_id(
    db: SessionWithUser, user: str, dataset: MatrixDataset,
) -> dict[str, str]:
    """
    Try loading feature labels from metadata.
    If there are no labels in the metadata or there is no metadata, then just return the feature names.
    """
    metadata_labels_by_given_id = dataset_crud.get_dataset_feature_annotations(
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
    db: SessionWithUser, user: str, dataset: MatrixDataset,
) -> dict[str, str]:
    """
    Try loading sample labels from metadata.
    If there are no labels in the metadata or there is no metadata, then just return the sample names.
    """
    metadata_labels = dataset_crud.get_dataset_sample_annotations(
        db=db, user=user, dataset=dataset, metadata_col_name="label"
    )
    if metadata_labels:
        return metadata_labels
    else:
        samples = dataset_crud.get_dataset_samples(db=db, dataset=dataset, user=user)
        return {sample.given_id: sample.given_id for sample in samples}


def get_dataset_feature_by_label(
    db: SessionWithUser, dataset_id: str, feature_label: str
) -> DatasetFeature:
    """Load the dataset feature corresponding to the given dataset ID and feature label"""

    dataset = dataset_crud.get_dataset(db, db.user, dataset_id)
    if dataset is None:
        raise ResourceNotFoundError(f"Dataset '{dataset_id}' not found.")
    dataset_crud.assert_user_has_access_to_dataset(dataset, db.user)
    assert isinstance(dataset, MatrixDataset)

    labels_by_given_id = get_dataset_feature_labels_by_id(db, db.user, dataset)
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
    dataset_crud.assert_user_has_access_to_dataset(dataset, db.user)
    assert isinstance(dataset, MatrixDataset)

    labels_by_given_id = get_dataset_sample_labels_by_id(db, db.user, dataset)
    given_ids_by_label = {label: id for id, label in labels_by_given_id.items()}
    sample_given_id = given_ids_by_label.get(sample_label)
    if sample_given_id is None:
        raise ResourceNotFoundError(
            f"Sample label '{sample_label}' not found in dataset '{dataset_id}'."
        )

    return dataset_crud.get_dataset_sample_by_given_id(db, dataset_id, sample_given_id)
