import tempfile
import time
from typing import Any, List, Optional, Tuple, Union
from uuid import uuid4
import dataclasses
import warnings

import pandas as pd

from depmap_compute import models
from depmap_compute import analysis_tasks_interface
from depmap_compute.analysis_tasks_interface import Feature

from breadbox.db.session import SessionWithUser
from breadbox.config import get_settings
from breadbox.io.data_validation import validate_and_upload_dataset_files
from breadbox.io.filestore_crud import get_slice

from breadbox.models.dataset import (
    Dataset,
    DatasetFeature,
    MatrixDataset,
    ValueType,
)
from breadbox.schemas.custom_http_exception import ResourceNotFoundError, UserError

from breadbox.schemas.dataset import MatrixDatasetIn
from breadbox.service import metadata as metadata_service

from ..crud.dimension_types import get_dimension_type
from ..crud import dataset as dataset_crud
from ..service import dataset as dataset_service
from ..crud import group as group_crud
from ..io import filestore_crud
from .celery import app
from ..db.util import db_context
from breadbox.io.upload_utils import create_upload_file


@app.task()
def test_task(message):
    print(f"test task got called {message}")


def _format_breadbox_shim_slice_id(dataset_id: str, feature_id: str):
    """
    This slice id formatting logic would normally live in the breadbox shim.
    However, because of the number of values being returned, it is much more
    convenient to have some logic here to return breadbox feature ids in the format that
    data explorer 1 expects.
    """
    return f"breadbox/{dataset_id}/{feature_id}"


def _subset_feature_df(query_series, index_subset=None) -> Tuple[List[str], list]:
    if index_subset is not None:
        # Convert sets to lists since pandas 2.0+ doesn't support sets as indexers
        intersection = list(
            set.intersection(set(query_series.index), set(index_subset))
        )
        query_series = query_series.loc[intersection]

    return (
        query_series.index.tolist(),
        query_series.values.tolist(),
    )


def get_feature_data_slice_values(
    db: SessionWithUser,
    user: str,
    dataset_feature_id: str,
    dataset: Dataset,
    filestore_location: str,
) -> pd.DataFrame:
    warnings.warn(
        "get_feature_data_slice_values is deprecated and should only be used by legacy Elara functionality."
    )

    feature = dataset_crud.get_dataset_feature_by_uuid(
        db, user, dataset=dataset, feature_uuid=dataset_feature_id
    )
    data_slice = get_slice(dataset, [feature.index], None, filestore_location,)
    data_slice.dropna(inplace=True)
    return data_slice


def _filter_out_models_not_in_search_dataset(
    feature_df: pd.DataFrame,
    model_query_vector: List[str],
    value_query_vector: Union[List[float], List[int]],
) -> Tuple[List[str], List[float], pd.DataFrame]:
    final_model_query_vector = []
    final_value_query_vector = []
    transposed_feature_df = feature_df.transpose()
    for model in list(transposed_feature_df.columns.values):
        if model in model_query_vector:
            final_model_query_vector.append(model)
            if model_query_vector.index(model) < len(value_query_vector):
                final_value_query_vector.append(
                    value_query_vector[model_query_vector.index(model)]
                )
        else:
            transposed_feature_df.drop(model, axis=1, inplace=True)

    return (
        final_model_query_vector,
        final_value_query_vector,
        transposed_feature_df.transpose(),
    )


def _get_filtered_dataset_and_query_feature(
    analysis_type: str,
    dataset: Dataset,  # dataset we're searching
    query_series: pd.DataFrame,
    filestore_location: str,
    depmap_model_ids: List[str],
    query_values: Optional[List[Any]] = [],
    feature_indices: List[int] = [],  # indices for the dataset we're searching
) -> Tuple[List[str], Union[List[int], List[float]], pd.DataFrame]:

    # Get the dataframe of features for the dataset we're searching in
    feature_df = get_slice(
        dataset, feature_indices, None, filestore_location, keep_nans=True
    )

    if analysis_type == models.AnalysisType.two_class:
        model_query_vector = depmap_model_ids
        assert all(
            x in {"in", "out"} for x in query_values
        ), f"Expecting values in {query_values} to be either 'in' or 'out'"
        value_query_vector = [0 if x == "out" else 1 for x in query_values]
    elif (
        analysis_type == models.AnalysisType.pearson
        or analysis_type == models.AnalysisType.association
    ):
        assert query_series.shape[1] == 1
        model_query_vector, value_query_vector = _subset_feature_df(
            query_series.iloc[:, 0], depmap_model_ids
        )

    else:
        raise ValueError(f"Unexpected analysis type {analysis_type}")

    (
        filtered_model_query_vector,
        filtered_value_query_vector,
        filtered_feature_df,
    ) = _filter_out_models_not_in_search_dataset(
        feature_df, model_query_vector, value_query_vector
    )

    return (
        filtered_model_query_vector,
        filtered_value_query_vector,
        filtered_feature_df,
    )


# returns a set of features and their indices in the same order such the features[i] corresponds to indices[i]
def get_features_info_and_dataset(
    db: SessionWithUser,
    user: str,
    dataset_id: str,
    feature_filter_labels: Optional[List[str]] = None,
    use_feature_ids=False,
) -> Tuple[List[Feature], List[int], Dataset]:
    dataset = dataset_crud.get_dataset(db, user, dataset_id)
    if dataset is None:
        raise ResourceNotFoundError(f"Dataset '{dataset_id}' not found.")
    dataset_features = dataset_crud.get_matrix_dataset_features(db, dataset)

    result_features: List[Feature] = []
    dataset_feature_ids: List[str] = []
    datasets: List[Dataset] = []
    feature_labels_by_id = metadata_service.get_matrix_dataset_feature_labels_by_id(
        db, user, dataset
    )
    feature_indices = []

    for dataset_feat in dataset_features:
        dataset = dataset_crud.get_dataset(db, user, dataset_feat.dataset_id)
        if dataset is None and dataset_feat.dataset is not None:
            raise ResourceNotFoundError(f"Dataset '{dataset_id}' not found.")
        dataset = dataset_feat.dataset
        assert dataset.sample_type_name == "depmap_model"

        # Custom downloads has an option to filter by feature labels. This filtering takes place
        # here if the feature_filter_labels list is not None.

        label = feature_labels_by_id.get(dataset_feat.given_id)
        has_label = label is not None
        has_filter = feature_filter_labels is not None
        if has_label and (
            (has_filter and label in feature_filter_labels) or (not has_filter)
        ):
            if use_feature_ids:
                # Feature.slice_id is converted to a string so that it can be used as
                # vectorId in the custom analysis table.
                slice_id = _format_breadbox_shim_slice_id(
                    dataset_feat.dataset_id, dataset_feat.given_id
                )
            else:
                slice_id = str(dataset_feat.id)
            result_feature = Feature(label=label, slice_id=slice_id)
            result_features.append(result_feature)
            dataset_feature_ids.append(dataset_feat.id)
            feature_indices.append(dataset_feat.index)
            datasets.append(dataset)

    # All features should come from the same dataset
    assert len(set(datasets)) <= 1

    # HDF5 indexing requires that when slicing out by index, the indices are sorted. I personally
    # would prefer to handle this inside of our code for reading from HDF5 so we don't have to worry
    # about that -- but we are addressing an issue at the moment and I want to mimize the impact of
    # changes right now. So, we'll sort feature_indices and reorder result_features to match

    reordered_indices = sorted(
        list(range(len(feature_indices))), key=lambda i: feature_indices[i]
    )

    result_features = [result_features[i] for i in reordered_indices]
    feature_indices = [feature_indices[i] for i in reordered_indices]

    assert sorted(feature_indices) == feature_indices

    return result_features, feature_indices, dataset


def _get_update_message_callback(task):
    last_state_update = {
        "start_time": time.time(),
        "message": "Beginning calculations...",
    }

    def update_message(
        message=None, start_time=None, max_time: int = 45, percent_complete=None
    ):
        """
        :start_time: the presence of this is used to determine whether we show a progress presented
        :max_time: used to calculate to the end of a fake gloating bar
        """
        # remember the value used for the last update_message so that we don't have to pass all the parameters every time.
        nonlocal last_state_update

        if message is not None:
            last_state_update["message"] = message
        if start_time is not None:
            last_state_update["start_time"] = start_time
        last_state_update["max_time"] = max_time
        last_state_update["percent_complete"] = percent_complete

        if not task.request.called_directly:
            task.update_state(
                state="PROGRESS", meta=last_state_update,
            )

    return update_message


@app.task(bind=True)
def run_custom_analysis(
    self,
    user: str,
    analysis_type: str,  # pearson, association, or two_class
    query_node_id: Optional[str],  # Query feature spec used by elara (deprecated)
    query_feature_id: Optional[
        str
    ],  # Query feature spec used by the portal (feature given id)
    query_dataset_id: Optional[
        str
    ],  # Query feature spec used by the portal (dataset id or dataset given id)
    filestore_location: str,
    dataset_id: str,
    vector_is_dependent: bool,
    results_dir: str,
    depmap_model_ids: List[str] = [],
    query_values: Optional[List[Any]] = None,
):
    if self.request.called_directly:
        task_id = "called_directly"
    else:
        task_id = self.request.id

    update_message = _get_update_message_callback(self)
    update_message("Fetching data")

    with db_context(user) as db:

        # All features and feature_indices for the dataset we're searching in
        use_feature_ids = query_node_id is None
        features, feature_indices, dataset = get_features_info_and_dataset(
            db, user, dataset_id, use_feature_ids=use_feature_ids
        )
        if not isinstance(dataset, MatrixDataset):
            raise UserError(
                f"Expected a matrix dataset. Unable to run custom analysis for tabular dataset: '{dataset_id}' "
            )
        feature_type_name = dataset.feature_type_name

        # Pearson and association calculate the value_query_vector they're searching
        # for by getting the data_slice, and separating the values and model_names into.
        # two_class skips this if block because it's value_query_vector is ultimately turned into
        # 1's and 0's dependning on "in" vs "out" values in queryValues.
        query_series = None

        if (
            analysis_type == models.AnalysisType.pearson
            or analysis_type == models.AnalysisType.association
        ):
            if query_node_id:
                # This is the node for the feature of the vector we're querying
                dataset_feature_id = query_node_id
                feature_dataset = dataset_crud.get_dataset(db, user, dataset_feature_id)
                if feature_dataset is None:
                    raise ResourceNotFoundError("Query dataset not found")
                query_series = get_feature_data_slice_values(
                    db, user, dataset_feature_id, feature_dataset, filestore_location
                )
            elif query_feature_id and query_dataset_id:
                # The given query Id should be the id of the feature itself
                feature = dataset_crud.get_dataset_feature_by_given_id(
                    db, query_dataset_id, query_feature_id
                )
                query_series = filestore_crud.get_feature_slice(
                    dataset=feature.dataset,
                    feature_indexes=[feature.index],
                    filestore_location=filestore_location,
                )
                query_series.dropna(inplace=True)
            # The query ID can be a numeric node id OR a UUID feature ID
            else:
                # Use the given query values instead of trying to load them from the query_id
                query_series = pd.Series(
                    query_values, index=depmap_model_ids
                ).to_frame()

        (
            filtered_cell_line_list,
            filtered_query_values_list,
            dataset_df,
        ) = _get_filtered_dataset_and_query_feature(
            analysis_type,
            dataset,
            query_series,
            filestore_location,
            depmap_model_ids,
            query_values,
            feature_indices,
        )
        if len(filtered_cell_line_list) == 0:
            raise UserError(
                "No cell lines in common between query and dataset searched"
            )

        parameters = dict(
            datasetId=dataset_id,
            query=dict(
                analysisType=analysis_type,
                queryId=query_node_id,
                queryFeatureId=query_feature_id,
                queryDatasetId=query_dataset_id,
                queryValues=filtered_query_values_list,
                vectorIsDependent=vector_is_dependent,
                queryCellLines=filtered_cell_line_list,
            ),
        )

        def wrapped_create_cell_line_group(*args, **kwargs):
            # this exists so we can add `user` as a parameter
            return create_cell_line_group(user, *args, **kwargs)

        result = analysis_tasks_interface.run_custom_analysis(
            task_id,
            update_message,
            analysis_type=analysis_type,
            depmap_model_ids=filtered_cell_line_list,
            value_query_vector=filtered_query_values_list,
            features=features,
            feature_type=feature_type_name,
            dataset=dataset_df.to_numpy().transpose(),
            vector_is_dependent=vector_is_dependent,
            parameters=parameters,
            result_dir=results_dir,
            create_cell_line_group=wrapped_create_cell_line_group,
            use_feature_ids=use_feature_ids,
        )

        return result


def _create_csv_file(feature_ids=[], sample_ids=["ACH-1", "ACH-2"], values=[]):
    import csv
    from io import StringIO, BytesIO
    import numpy as np

    buf = StringIO()
    w = csv.writer(buf)
    w.writerow([""] + feature_ids)
    idx_counter = 0

    if np.array(values).ndim == 1:
        for sample_id in sample_ids:
            row = [sample_id]
            for i in range(len(feature_ids)):
                row.append(values[idx_counter])
                idx_counter += 1
                if idx_counter == len(values):
                    idx_counter = 0
            w.writerow(row)
    else:
        for i, sample_id in enumerate(sample_ids):
            row = [sample_id]
            row.extend(values[i])
            w.writerow(row)

    result = BytesIO(buf.getvalue().encode("utf8"))
    assert result.tell() == 0

    return result


def create_cell_line_group(
    user: str, cell_lines: List[str], use_feature_ids: bool = False
) -> str:
    assert user is not None

    dataset_id = str(uuid4())
    feature_label = "custom_cell_lines"

    with db_context(user, commit=True) as db:
        with tempfile.NamedTemporaryFile() as fd:
            from io import BytesIO

            csv_file = _create_csv_file(
                [feature_label], cell_lines, [True for i in enumerate(cell_lines)]
            )
            csv_file.seek(0)
            fd.writelines(csv_file)
            fd.seek(0)
            fd.flush()

            settings = get_settings()
            generic_feature_type = get_dimension_type(db, "generic")
            depmap_model_sample_type = get_dimension_type(db, "depmap_model")

            (
                feature_given_id_and_index_df,
                sample_given_id_and_index_df,
                feature_warnings,
                sample_warnings,
            ) = dataclasses.astuple(
                validate_and_upload_dataset_files(
                    db,
                    dataset_id,
                    data_file=create_upload_file(
                        filename=dataset_id,
                        file=BytesIO(fd.read()),
                        content_type="text/csv",
                    ),
                    feature_type=generic_feature_type,
                    sample_type=depmap_model_sample_type,
                    filestore_location=settings.filestore_location,
                    value_type=ValueType.categorical,
                    allowed_values=["False", "True"],
                )
            )

            dataset_in = MatrixDatasetIn(
                name=fd.name,
                units="string",
                is_transient=True,
                group_id=group_crud.TRANSIENT_GROUP_ID,
                feature_type_name="generic",
                sample_type_name="depmap_model",
                data_type="User upload",
                id=dataset_id,
                given_id=None,
                value_type=ValueType.categorical,
                allowed_values=["False", "True"],
                priority=None,
                taiga_id=None,
                dataset_metadata=None,
                dataset_md5=None,
            )
            dataset_service.add_matrix_dataset(
                db,
                user,
                dataset_in,
                feature_given_id_and_index_df,
                sample_given_id_and_index_df,
                generic_feature_type,
                depmap_model_sample_type,
                short_name=None,
                version=None,
                description=None,
            )

        # Return the feature ID associated with the new dataset feature
        if use_feature_ids:
            feature: DatasetFeature = metadata_service.get_dataset_feature_by_label(
                db=db, dataset_id=dataset_id, feature_label=feature_label
            )
            return _format_breadbox_shim_slice_id(feature.dataset_id, feature.given_id)
        else:
            dataset_feature = metadata_service.get_dataset_feature_by_label(
                db, dataset_id, feature_label
            )
            return str(dataset_feature.id)
