import pandas as pd
from typing import Optional

from breadbox.db.session import SessionWithUser
import breadbox.crud.dataset as dataset_crud
from breadbox.schemas.dataset import SliceQueryIdentifierType, TabularDimensionsInfo
from breadbox.schemas.custom_http_exception import (
    ResourceNotFoundError,
    UserError,
)
from breadbox.io.filestore_crud import (
    get_feature_slice,
    get_sample_slice,
)

from depmap_compute.slice import SliceQuery


def get_slice_data(
    db: SessionWithUser, filestore_location: str, slice_query: SliceQuery
) -> pd.Series:
    """
    Loads data for the given slice query. 
    The result will be a pandas series indexed by sample/feature ID 
    (regardless of the identifier_type used in the query).
    """
    dataset_id = slice_query.dataset_id
    dataset = dataset_crud.get_dataset(db=db, user=db.user, dataset_id=dataset_id)
    if dataset is None:
        raise ResourceNotFoundError("Dataset not found")

    if slice_query.identifier_type == "column":
        if not dataset.format == "tabular_dataset":
            raise UserError(
                "The slice query identifier type `column` may only be used with tabular datasets."
            )
        tabular_dimension_info = TabularDimensionsInfo(columns=[slice_query.identifier])
        slice_data = dataset_crud.get_subsetted_tabular_dataset_df(
            db=db,
            user=db.user,
            dataset=dataset,
            tabular_dimensions_info=tabular_dimension_info,
            strict=True,
        )

    elif dataset.format == "tabular_dataset":
        # Ideally, you could load a row of tabular data by specifying a row identifier.
        # We can add support for this later if it's helpful. Currently, there's no use-case for it.
        raise NotImplementedError(
            "Not yet implemented. To load tabular data by row, use the get_tabular_dataset_data endpoint instead."
        )

    elif slice_query.identifier_type == "feature_id":
        feature = dataset_crud.get_dataset_feature_by_given_id(
            db, dataset_id, feature_given_id=slice_query.identifier
        )
        slice_data = get_feature_slice(dataset, [feature.index], filestore_location)

    elif slice_query.identifier_type == "feature_label":
        feature = dataset_crud.get_dataset_feature_by_label(
            db, dataset_id, feature_label=slice_query.identifier,
        )
        slice_data = get_feature_slice(dataset, [feature.index], filestore_location)

    elif slice_query.identifier_type == "sample_id":
        sample = dataset_crud.get_dataset_sample_by_given_id(
            db, dataset_id, sample_given_id=slice_query.identifier
        )
        slice_data = get_sample_slice(dataset, [sample.index], filestore_location)

    elif slice_query.identifier_type == "sample_label":
        sample = dataset_crud.get_dataset_sample_by_label(
            db, dataset_id, sample_label=slice_query.identifier
        )
        slice_data = get_sample_slice(dataset, [sample.index], filestore_location)

    else:
        raise ResourceNotFoundError(
            f"Unrecognized slice query identifier type: `{slice_query.identifier_type}`",
        )

    if slice_data.empty or slice_data is None:
        raise ResourceNotFoundError("No data matches the given slice query.")

    # Convert the single-col/row DataFrame into a series and drop null values
    return slice_data.dropna().squeeze()


def get_labels_for_slice_type(
    db: SessionWithUser, slice_query: SliceQueryIdentifierType
) -> Optional[dict[str, str]]:
    """
    For the given slice query identifier type, get a dictionary of all dataset labels and IDs.
    If the identifier type does not have labels, return None.
    """
    dataset = dataset_crud.get_dataset(db, db.user, slice_query.dataset_id)
    if dataset is None:
        raise ResourceNotFoundError(f"Dataset '{slice_query.dataset_id}' not found.")

    if slice_query.identifier_type in {"feature_label", "feature_id"}:
        return dataset_crud.get_dataset_sample_labels_by_id(db, db.user, dataset)
    elif slice_query.identifier_type in {"sample_label", "sample_id"}:
        return dataset_crud.get_dataset_feature_labels_by_id(db, db.user, dataset)
    else:
        # Columns don't have labels, so just return None
        return None
