import pandas as pd
from typing import Any, Optional

from breadbox.db.session import SessionWithUser
import breadbox.crud.dataset as dataset_crud
from breadbox.schemas.context import Context
from breadbox.schemas.dataset import TabularDimensionsInfo
from breadbox.schemas.custom_http_exception import (
    ResourceNotFoundError,
    UserError,
)
from breadbox.io.filestore_crud import (
    get_feature_slice,
    get_sample_slice,
)

from depmap_compute.slice import SliceQuery
from depmap_compute.context import (
    ContextEvaluator,
    LegacyContextEvaluator,
)
from depmap_compute.slice import slice_id_to_slice_query


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
    else:
        # Columns don't have labels, so just return None
        return None


def get_ids_and_labels_matching_context(
    db: SessionWithUser, filestore_location: str, context: Context
) -> tuple[list[str], list[str]]:
    """
    For a given context, load all matching IDs and labels.
    Both context versions are supported here. 
    """
    # Identify which type of context has been provided
    # Legacy contexts use the "context_type" field name, while newer contexts use "dimension_type"
    if context.context_type:
        dimension_type = context.context_type
        slice_loader_function = lambda slice_id: get_slice_data_from_legacy_slice_id(
            db, filestore_location, slice_id
        )
        context_evaluator = LegacyContextEvaluator(
            context.dict(), slice_loader_function
        )
    else:
        dimension_type = context.dimension_type
        slice_loader_function = lambda slice_query: get_slice_data(
            db, filestore_location, slice_query
        )
        context_evaluator = ContextEvaluator(context.dict(), get_slice_data)

    if dimension_type is None:
        raise ValueError("Context requests must specify a dimension type.")
    # Load all dimension labels and ids
    all_labels_by_id = dataset_crud.get_dimension_labels_by_id(db, dimension_type)

    # Evaluate each against the context
    ids_matching_context = []
    labels_matching_context = []
    for given_id, label in all_labels_by_id.items():
        if context_evaluator.is_match(given_id):
            ids_matching_context.append(given_id)
            labels_matching_context.append(label)

    return ids_matching_context, labels_matching_context


def get_slice_data_from_legacy_slice_id(
    db: SessionWithUser, filestore_location: str, slice_id: str
) -> dict[str, Any]:
    """
    Loads data for the given slice ID string. Exists to support legacy contexts.
    The result should be a dictionary containing the dimension's values keyed by sample/feature ID
    """
    slice_query = slice_id_to_slice_query(slice_id)
    return get_slice_data(db, filestore_location, slice_query)
