import os
from cProfile import label
from typing import List, Union

import numpy as np
import pandas as pd
from numpy.array_api import float64

from breadbox.db.session import SessionWithUser
from depmap_compute.slice import SliceQuery

from breadbox.io.filestore_crud import get_feature_slice, read_chunked_feature_data
from breadbox.models.dataset import MatrixDataset, DatasetFeature
from breadbox.schemas.associations import (
    Associations,
    Association,
    DatasetSummary,
    LongAssociationsTable,
)
from breadbox.crud import associations as associations_crud
from breadbox.crud import dataset as dataset_crud
from breadbox.schemas.custom_http_exception import (
    ResourceNotFoundError,
    UserError,
    DatasetNotAMatrix,
)
from breadbox.schemas.dataset import MatrixDimensionsInfo
from breadbox.service import slice as slice_service
import logging
from breadbox.crud.dimension_types import get_dimension_type_labels_by_id
import breadbox.crud.dimension_types as dimension_types_crud

import packed_cor_tables

from breadbox.service.dataset import get_subsetted_matrix_dataset_df

log = logging.getLogger(__name__)


def get_associations(
    db: SessionWithUser, filestore_location: str, slice_query: SliceQuery
) -> Associations:
    dataset_id = slice_query.dataset_id

    dataset = dataset_crud.get_dataset(db, db.user, dataset_id)
    if dataset is None:
        raise ResourceNotFoundError(f"Could not find dataset {dataset_id}")

    precomputed_assoc_tables = associations_crud.get_association_tables(db, dataset.id)
    datasets = []
    associated_dimensions = []

    resolved_slice = slice_service.resolve_slice_to_components(db, slice_query)

    dim_label_cache = {}

    def _get_dimension_label(dimension_type, given_id):
        # if the dimension type is None, we use the dataset's dimension given_id as the label
        if not dimension_type:
            return given_id
        if dimension_type not in dim_label_cache:
            dim_label_cache[dimension_type] = get_dimension_type_labels_by_id(
                db, dimension_type
            )
        labels_by_id = dim_label_cache[dimension_type]
        if given_id in labels_by_id:
            return labels_by_id[given_id]
        else:
            # there is a dimension type, and all valid given_ids are defined in that dimension type. If given_id is not included in the dimension type, we want act like that dimension doesn't exist
            return None

    for precomputed_assoc_table in precomputed_assoc_tables:
        assert precomputed_assoc_table.dataset_1_id == dataset.id
        other_dataset = precomputed_assoc_table.dataset_2

        if slice_query.identifier_type in ["feature_id", "feature_label", "column"]:
            other_dimension_type = other_dataset.feature_type_name
        else:
            assert slice_query.identifier_type in ["sample_id", "sample_label"]
            other_dimension_type = other_dataset.sample_type_name

        datasets.append(
            DatasetSummary(
                id=precomputed_assoc_table.id,
                name=other_dataset.name,
                dimension_type=other_dimension_type,
                dataset_id=other_dataset.id,
            )
        )

        precomputed_assoc_table_path = os.path.join(
            filestore_location, precomputed_assoc_table.filename
        )

        correlation_df = packed_cor_tables.read_cor_for_given_id(
            precomputed_assoc_table_path, resolved_slice.given_id
        )

        for row in correlation_df.to_records():
            other_dimension_given_id = row["feature_given_id_1"]
            associated_label = _get_dimension_label(
                other_dimension_type, other_dimension_given_id
            )
            if associated_label is None:
                log.warning(
                    f"Could not find {other_dimension_type} with id {other_dimension_given_id}"
                )
                continue

            log10qvalue = row["log10qvalue"]

            # if correlation is 1 then the qvalue can be 0 which results in log10 qvalue to be -inf
            # if we see this, bound it at -1e100 to avoid json serialization error
            if np.isinf(log10qvalue):
                log10qvalue = -1e100

            associated_dimensions.append(
                Association(
                    correlation=row["cor"],
                    log10qvalue=log10qvalue,
                    other_dataset_id=other_dataset.id,
                    other_dimension_given_id=other_dimension_given_id,
                    other_dimension_label=associated_label,
                )
            )

    return Associations(
        dataset_name=dataset.name,
        dimension_label=resolved_slice.label,
        associated_datasets=datasets,
        associated_dimensions=associated_dimensions,
    )


def np_cor(col, m):
    # compute pearson correlation coefficient on a single column (col) against all the columns in matrix m
    # using numpy vectorized operations

    n_rows, n_cols = m.shape

    col_v = col.reshape((n_rows, 1))
    mask = np.isnan(m) | np.isnan(col_v)

    n = np.sum(~mask, axis=0)
    x_mean = np.sum(np.where(mask, 0, col_v), axis=0) / n
    y_mean = np.sum(np.where(mask, 0, m), axis=0) / n

    x_centered = np.where(mask, 0, col_v - x_mean.reshape((1, n_cols)))
    y_centered = np.where(mask, 0, m - y_mean.reshape((1, n_cols)))

    numerator = np.sum((x_centered * y_centered), axis=0)
    denominator = np.sqrt(
        np.sum((x_centered * x_centered), axis=0)
        * np.sum((y_centered * y_centered), axis=0)
    )

    return numerator / denominator


def _corr_with(reference: Union[pd.Series, pd.DataFrame], other: pd.DataFrame):
    # using DataFrame.corrwith, but that method does a vectorized correlation calculation and we want to always correlate the same column with the columns in other.
    # (ie: DataFrame.corrwith(a, b) computes [ cor(a[0], other[0]) , ... ,cor(a[i], other[i]) ]
    # and we want to compute [cor(a, other[0]), ..., cor(a, other[i])] )
    if isinstance(reference, pd.DataFrame):
        assert len(reference.columns) == 1
    left = reference.reindex(other.index)

    # precision isn't so important here, so use float32 to make it faster
    left_np = left.to_numpy("float32")
    right_np = other.to_numpy("float32")
    return pd.Series(np_cor(left_np, right_np), index=other.columns)

    # # duplicate left so we can compute the pairwise correlations
    # dupped_cols = pd.concat([left] * len(other.columns), axis=1)
    # dupped_cols.columns = other.columns
    #
    # return dupped_cols.corrwith(other)


import time


def compute_associations(
    db: SessionWithUser,
    filestore_location: str,
    other_dataset: MatrixDataset,
    profile_slice_query: SliceQuery,
) -> pd.Series:
    beginning = time.time()
    """ Computes correlation between all features in `other_dataset` with the profile specified by `profile_slice_query` """
    resolved_slice = slice_service.resolve_slice_to_components(db, profile_slice_query)

    log.warning("here")
    print(
        f"Calling get_dataset_feature_by_given_id(dataset_id={resolved_slice.dataset.id}, feature_given_id={resolved_slice.given_id}"
    )
    feature = dataset_crud.get_dataset_feature_by_given_id(
        db=db,
        dataset_id=resolved_slice.dataset.id,
        feature_given_id=resolved_slice.given_id,
    )

    if not isinstance(resolved_slice.dataset, MatrixDataset):
        raise UserError(
            f"Expected a matrix dataset. Unable to load feature data for tabular dataset: '{feature.dataset_id}' "
        )

    # Read data from the HDF5 file
    if feature.index is None:
        raise ValueError(f"Feature {feature.given_id} has no index")

    reference_profile = get_feature_slice(
        resolved_slice.dataset, [feature.index], filestore_location
    )

    results: List[pd.Series] = []
    time_spent_in_cor = 0.0

    log.warning(
        f"other_dataset={other_dataset.id} feature_type={other_dataset.feature_type_name}"
    )
    start = time.time()
    # Isn't there a better way to get this? I don't actually need the "index" column: just given_id and label.
    # I think we should have a method for this.
    query_results = list(
        db.query(DatasetFeature)
        .filter(DatasetFeature.dataset_id == other_dataset.id)
        .with_entities(DatasetFeature.given_id, DatasetFeature.index)
        .all()
    )
    given_id_index_mapping = pd.DataFrame(
        query_results,
        columns=pd.Index(["given_id", "index"]),  # type: ignore[arg-type]
    )

    if other_dataset.feature_type_name is None:
        # this special case again: not having a feature_type_name means given_id == label. Should this go into get_dimension_type_labels_by_id?
        given_id_index_mapping["label"] = given_id_index_mapping["given_id"]
    else:
        label_by_id = dimension_types_crud.get_dimension_type_labels_by_id(
            db, other_dataset.feature_type_name
        )
        given_id_index_mapping["label"] = [
            label_by_id.get(x) for x in given_id_index_mapping["given_id"]
        ]

    given_id_index_mapping = given_id_index_mapping.set_index("index")
    log.warning(f"time fetching labels {time.time() - start}")
    print(given_id_index_mapping)

    for other_profiles in read_chunked_feature_data(other_dataset, filestore_location):
        log.warning("starting corr")
        start = time.time()
        cor_series = _corr_with(reference_profile, other_profiles)
        # cor_series's index is given_id from other_profiles
        time_spent_in_cor += time.time() - start
        log.warning("ending corr")
        assert len(cor_series) == len(other_profiles.columns)
        results.append(cor_series)

    log.warning(f"{time_spent_in_cor} seconds in corr")
    concatted_result = pd.concat(results)
    log.warning(f"{time.time() - beginning} seconds for whole call")
    left = pd.DataFrame({"cor": concatted_result}, index=concatted_result.index)
    with_ids = pd.merge(
        left, given_id_index_mapping, left_index=True, right_on="given_id", how="inner"
    )
    mask = ~pd.isna(with_ids["cor"])  # boolean Series
    filtered = with_ids.loc[mask]
    return filtered.set_index("given_id")["cor"]
