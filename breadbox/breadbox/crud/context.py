import pandas as pd
from typing import Any

from fastapi import HTTPException

from depmap_compute.context import ContextEvaluator, decode_slice_id
from depmap_compute.slice import SliceQuery

from breadbox.db.session import SessionWithUser
from breadbox.config import Settings
from breadbox.crud import dataset as dataset_crud
from breadbox.io import filestore_crud
from breadbox.models.dataset import MatrixDataset, TabularDataset
from breadbox.schemas.custom_http_exception import UserError
from breadbox.schemas.dataset import TabularDimensionsInfo


def get_slice_data(
    db: SessionWithUser, settings: Settings, slice_query: SliceQuery
) -> pd.Series:
    """
    Loads data for the given slice query. 
    The result will be a pandas series indexed by sample/feature ID 
    (regardless of the identifier_type used in the query).
    """
    filestore_location = settings.filestore_location
    dataset_id = slice_query.dataset_id
    dataset = dataset_crud.get_dataset(db=db, user=db.user, dataset_id=dataset_id)
    if dataset is None:
        raise HTTPException(404, "Dataset not found")

    if slice_query.identifier_type == "feature_id":
        feature = dataset_crud.get_dataset_feature_by_given_id(
            db=db,
            user=db.user,
            dataset_id=dataset_id,
            feature_label=slice_query.identifier,
        )
        slice_data = filestore_crud.get_feature_slice(
            dataset, [feature.index], filestore_location
        )

    elif slice_query.identifier_type == "feature_label":
        feature = dataset_crud.get_dataset_feature_by_label(
            db=db,
            user=db.user,
            dataset_id=dataset_id,
            feature_label=slice_query.identifier,
        )
        slice_data = filestore_crud.get_feature_slice(
            dataset, [feature.index], filestore_location
        )

    elif slice_query.identifier_type == "sample_id":
        sample = None  # TODO: implement sample lookup by ID
        slice_data = filestore_crud.get_sample_slice(
            dataset, [sample.index], filestore_location
        )

    elif slice_query.identifier_type == "sample_label":
        sample = None  # TODO: implement sample lookup by Label
        slice_data = filestore_crud.get_sample_slice(
            dataset, [sample.index], filestore_location
        )

    elif slice_query.identifier_type == "column":
        if not dataset.format == "tabular_dataset":
            raise UserError(
                f"The slice query identifier type `column` may only be used with tabular datasets. The dataset `{dataset_id}` is not tabular."
            )
        tabular_dimension_info = TabularDimensionsInfo(columns=[slice_query.identifier])
        slice_data = dataset_crud.get_subsetted_tabular_dataset_df(
            db=db,
            user=db.user,
            dataset=dataset,
            tabular_dimensions_info=tabular_dimension_info,
            strict=True,
        )

    else:
        raise HTTPException(
            404,
            f"Unrecognized slice query identifier type: `{slice_query.identifier_type}`",
        )

    if slice_data.empty or slice_data is None:
        raise HTTPException(404, f"No data matches the given slice query.")

    # Convert the single-col/row DataFrame into a series and drop null values
    return slice_data.dropna().squeeze()
