import logging

from breadbox.crud import dataset as dataset_crud
from breadbox.db.session import SessionWithUser
from breadbox.io.filestore_crud import get_slice
from breadbox.models.dataset import MatrixDataset
from breadbox.schemas.dataset import (
    FeatureSampleIdentifier,
    MatrixDimensionsInfo,
)
from breadbox.schemas.custom_http_exception import UserError
from breadbox.service import metadata as metadata_service

log = logging.getLogger(__name__)


def get_subsetted_matrix_dataset_df(
    db: SessionWithUser,
    user: str,
    dataset: MatrixDataset,
    dimensions_info: MatrixDimensionsInfo,
    filestore_location,
    strict: bool = False,  # False default for backwards compatibility
):
    """
    Load a dataframe containing data for the specified dimensions.
    If the dimensions are specified by label, then return a result indexed by labels
    """

    missing_features = []
    missing_samples = []

    if dimensions_info.features is None:
        feature_indexes = None
    elif dimensions_info.feature_identifier.value == "id":
        (
            feature_indexes,
            missing_features,
        ) = dataset_crud.get_feature_indexes_by_given_ids(
            db, user, dataset, dimensions_info.features
        )
    else:
        assert dimensions_info.feature_identifier.value == "label"
        (
            feature_indexes,
            missing_features,
        ) = dataset_crud.get_dimension_indexes_of_labels(
            db, user, dataset, axis="feature", dimension_labels=dimensions_info.features
        )

    if len(missing_features) > 0:
        log.warning(f"Could not find features: {missing_features}")

    if dimensions_info.samples is None:
        sample_indexes = None
    elif dimensions_info.sample_identifier.value == "id":
        sample_indexes, missing_samples = dataset_crud.get_sample_indexes_by_given_ids(
            db, user, dataset, dimensions_info.samples
        )
    else:
        sample_indexes, missing_samples = dataset_crud.get_dimension_indexes_of_labels(
            db, user, dataset, axis="sample", dimension_labels=dimensions_info.samples
        )

    if len(missing_samples) > 0:
        log.warning(f"Could not find samples: {missing_samples}")

    if strict:
        num_missing_features = len(missing_features)
        missing_features_msg = f"{num_missing_features} missing features: {missing_features[:20] + ['...'] if num_missing_features >= 20 else missing_features}"
        num_missing_samples = len(missing_samples)
        missing_samples_msg = f"{num_missing_samples} missing samples: {missing_samples[:20] + ['...'] if num_missing_samples >= 20 else missing_samples}"
        if len(missing_features) > 0 or len(missing_samples) > 0:
            raise UserError(f"{missing_features_msg} and {missing_samples_msg}")

    # call sort on the indices because hdf5_read requires indices be in ascending order
    if feature_indexes is not None:
        feature_indexes = sorted(feature_indexes)
    if sample_indexes is not None:
        sample_indexes = sorted(sample_indexes)

    df = get_slice(dataset, feature_indexes, sample_indexes, filestore_location)

    # Re-index by label if applicable
    if dimensions_info.feature_identifier == FeatureSampleIdentifier.label:
        labels_by_id = metadata_service.get_dataset_feature_labels_by_id(
            db, user, dataset
        )
        df = df.rename(columns=labels_by_id)

    if dimensions_info.sample_identifier == FeatureSampleIdentifier.label:
        label_by_id = metadata_service.get_dataset_sample_labels_by_id(
            db, user, dataset
        )
        df = df.rename(index=label_by_id)

    return df
