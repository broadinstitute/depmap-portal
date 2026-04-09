from dataclasses import dataclass
from typing import List

import pandas as pd

from breadbox.models.dataset import Dataset
from breadbox.db.session import SessionWithUser
import breadbox.crud.dataset as dataset_crud
from breadbox.schemas.dataset import TabularDimensionsInfo
from breadbox.schemas.custom_http_exception import (
    ResourceNotFoundError,
    UserError,
    DatasetNotFoundError,
)
from breadbox.io.filestore_crud import (
    get_feature_slice,
    get_sample_slice,
)
from breadbox.service import metadata as metadata_service
from breadbox.service import dataset as dataset_service
from breadbox.utils.asserts import index_error_msg

from breadbox.depmap_compute_embed.slice import SliceQuery
from breadbox.crud.dimension_ids import (
    get_dataset_sample_by_given_id,
    get_dataset_feature_by_given_id,
)


_MAX_REINDEX_DEPTH = 10


@dataclass
class ResolvedSliceIdentifiers:
    dataset: Dataset
    label: str
    given_id: str


def resolve_slice_to_components(
    db: SessionWithUser, slice_query: SliceQuery
) -> ResolvedSliceIdentifiers:
    dataset_id = slice_query.dataset_id

    dataset = dataset_crud.get_dataset(db, db.user, dataset_id)
    if dataset is None:
        raise ResourceNotFoundError(f"Could not find dataset {dataset_id}")

    if slice_query.identifier_type == "column":
        label = given_id = slice_query.identifier
    elif slice_query.identifier_type == "feature_id":
        given_id = slice_query.identifier
        label = metadata_service.get_dataset_feature_label_by_id(db, dataset, given_id)
        if label is None:
            raise ResourceNotFoundError(
                f"Could not find feature {given_id} in dataset {dataset_id}"
            )
    elif slice_query.identifier_type == "feature_label":
        feature = metadata_service.get_dataset_feature_by_label(
            db, dataset_id, feature_label=slice_query.identifier,
        )
        if feature is None:
            raise ResourceNotFoundError(
                f"Could not find feature with label {slice_query.identifier} in dataset {dataset_id}"
            )
        label = slice_query.identifier
        given_id = feature.given_id
    elif slice_query.identifier_type == "sample_id":
        given_id = slice_query.identifier
        label = metadata_service.get_dataset_sample_label_by_id(db, dataset, given_id)
        if label is None:
            raise ResourceNotFoundError(
                f"Could not find sample {given_id} in dataset {dataset_id}"
            )
    else:
        assert slice_query.identifier_type == "sample_label"
        sample = metadata_service.get_dataset_sample_by_label(
            db, dataset_id, sample_label=slice_query.identifier
        )
        if sample is None:
            raise ResourceNotFoundError(
                f"Could not find sample with label {slice_query.identifier} in dataset {dataset_id}"
            )
        given_id = sample.given_id
        label = slice_query.identifier

    return ResolvedSliceIdentifiers(dataset=dataset, label=label, given_id=given_id)


def _flatten_reindex_chain(leaf: SliceQuery) -> List[SliceQuery]:
    """
    Flatten the nested reindex_through chain into a list ordered [root, ..., leaf].
    The leaf is the outermost query (the data you want), and the root is the
    innermost reindex_through (the caller's index type).
    """
    chain = [leaf]
    current = leaf
    seen_datasets: set[tuple[str, str]] = {
        (leaf.dataset_id, leaf.identifier)
    }  # seed with leaf
    while current.reindex_through is not None:
        key = (current.reindex_through.dataset_id, current.reindex_through.identifier)
        if key in seen_datasets:
            raise UserError(
                f"Circular reference detected in reindex_through chain: "
                f"dataset '{key[0]}', identifier '{key[1]}' appears more than once."
            )
        if len(chain) >= _MAX_REINDEX_DEPTH:
            raise UserError(
                f"reindex_through chain exceeds maximum depth of {_MAX_REINDEX_DEPTH}."
            )
        seen_datasets.add(key)
        chain.append(current.reindex_through)
        current = current.reindex_through
    chain.reverse()
    return chain


def _resolve_reindex_chain(
    db: SessionWithUser, filestore_location: str, slice_query: SliceQuery
) -> pd.Series:
    """
    Resolve a SliceQuery with reindex_through by walking the FK chain.
    Each intermediate step loads an FK column, and the leaf loads the target data.
    Returns a Series indexed by the root's entity IDs with values from the leaf.
    """
    chain = _flatten_reindex_chain(slice_query)

    # Validate: all intermediate steps must use identifier_type "column"
    for step in chain[:-1]:
        if step.identifier_type != "column":
            raise UserError(
                f"Intermediate reindex_through steps must use identifier_type 'column', "
                f"but got '{step.identifier_type}' for dataset '{step.dataset_id}', "
                f"identifier '{step.identifier}'."
            )

    # Load each step's data as a simple (non-chained) slice query
    series_chain: List[pd.Series] = []
    for step in chain:
        simple_query = SliceQuery(
            dataset_id=step.dataset_id,
            identifier=step.identifier,
            identifier_type=step.identifier_type,
        )
        series_chain.append(get_slice_data(db, filestore_location, simple_query))

    # Compose: root maps root_ids → step1_ids, step1 maps step1_ids → step2_ids, etc.
    # The leaf maps final_ids → values. Chaining .map() yields root_ids → values.
    result = series_chain[0]
    for next_series in series_chain[1:]:
        result = result.map(next_series)

    return result.dropna()


def get_slice_data(
    db: SessionWithUser, filestore_location: str, slice_query: SliceQuery
) -> pd.Series:
    """
    Loads data for the given slice query. 
    The result will be a pandas series indexed by sample/feature ID 
    (regardless of the identifier_type used in the query).
    Note: the result may contain given_ids which do not exist in the metadata. These should not be returned to users.

    If slice_query.reindex_through is set, the result will be reindexed through
    a chain of FK joins, returning data indexed by the root entity IDs.
    """
    if slice_query.reindex_through is not None:
        return _resolve_reindex_chain(db, filestore_location, slice_query)

    dataset_id = slice_query.dataset_id
    dataset = dataset_crud.get_dataset(db=db, user=db.user, dataset_id=dataset_id)
    if dataset is None:
        raise DatasetNotFoundError(f"Dataset '{dataset_id}' not found")

    if slice_query.identifier_type == "column":
        if not dataset.format == "tabular_dataset":
            raise UserError(
                "The slice query identifier type `column` may only be used with tabular datasets."
            )
        tabular_dimension_info = TabularDimensionsInfo(columns=[slice_query.identifier])
        slice_data = dataset_service.get_subsetted_tabular_dataset_df(
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
        feature = get_dataset_feature_by_given_id(
            db, dataset_id, feature_given_id=slice_query.identifier
        )
        assert feature.index is not None, index_error_msg(feature)
        slice_data = get_feature_slice(dataset, [feature.index], filestore_location)

    elif slice_query.identifier_type == "feature_label":
        feature = metadata_service.get_dataset_feature_by_label(
            db, dataset_id, feature_label=slice_query.identifier,
        )
        assert feature.index is not None, index_error_msg(feature)
        slice_data = get_feature_slice(dataset, [feature.index], filestore_location)

    elif slice_query.identifier_type == "sample_id":
        sample = get_dataset_sample_by_given_id(
            db, dataset_id, sample_given_id=slice_query.identifier
        )
        assert sample.index is not None, index_error_msg(sample)
        slice_data = get_sample_slice(dataset, [sample.index], filestore_location)

    elif slice_query.identifier_type == "sample_label":
        sample = metadata_service.get_dataset_sample_by_label(
            db, dataset_id, sample_label=slice_query.identifier
        )
        assert sample.index is not None, index_error_msg(sample)
        slice_data = get_sample_slice(dataset, [sample.index], filestore_location)

    else:
        raise ResourceNotFoundError(
            f"Unrecognized slice query identifier type: `{slice_query.identifier_type}`",
        )

    if slice_data.empty or slice_data is None:
        raise ResourceNotFoundError("No data matches the given slice query.")

    # Convert the single-col/row DataFrame into a series and drop null values
    return slice_data.squeeze().dropna()
