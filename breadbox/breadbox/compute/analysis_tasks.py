import tempfile
import time
from typing import Any, List, Optional, Tuple, Union
from uuid import uuid4
import dataclasses
import warnings
from typing import cast, Sequence
import pandas as pd
from contextlib import contextmanager

from breadbox.depmap_compute_embed import models, FeaturesExtDataFrame
from breadbox.depmap_compute_embed import analysis_tasks_interface
import csv
from io import StringIO, BytesIO
import numpy as np

from breadbox.db.session import SessionWithUser
from breadbox.config import get_settings
from breadbox.io.data_validation import validate_and_upload_dataset_files
from breadbox.io.filestore_crud import get_slice
from breadbox.utils.asserts import index_error_msg
from breadbox.crud.dimension_ids import (
    get_dataset_feature_by_given_id,
    get_matrix_dataset_sample_df,
)

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
from ..crud.dimension_ids import (
    get_matrix_dataset_features_df,
    get_dataset_feature_by_uuid,
)
from ..crud import dataset as dataset_crud
from ..service import dataset as dataset_service
from ..crud import group as group_crud
from ..io import filestore_crud
from .celery import app, LogErrorsTask
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

    feature = get_dataset_feature_by_uuid(
        db, user, dataset=dataset, feature_uuid=dataset_feature_id
    )
    assert feature.index is not None, index_error_msg(feature)
    data_slice = get_slice(dataset, [feature.index], None, filestore_location,)
    data_slice.dropna(inplace=True)
    return data_slice


def _get_filtered_query_feature(
    db: SessionWithUser,
    analysis_type: str,
    dataset: Dataset,  # dataset we're searching
    query_series: Optional[pd.DataFrame],
    depmap_model_ids: List[str],
    query_values: Optional[List[str]],
):

    dataset_samples_df = get_matrix_dataset_sample_df(db, dataset, None)
    dataset_sample_ids_set = set(dataset_samples_df.given_id)

    if analysis_type == models.AnalysisType.two_class:
        assert query_values is not None
        model_query_vector = depmap_model_ids
        assert all(
            x in {"in", "out"} for x in query_values
        ), f"Expecting values in {query_values} to be either 'in' or 'out'"
        value_query_vector = [0 if x == "out" else 1 for x in query_values]

        # Validate that BOTH the in-group and out-group have cell lines present in the dataset
        in_group_sample_ids = {
            depmap_model_ids[i]
            for i in range(len(query_values))
            if query_values[i] == "in"
        }
        out_group_sample_ids = {
            depmap_model_ids[i]
            for i in range(len(query_values))
            if query_values[i] == "out"
        }
        if len(in_group_sample_ids.intersection(dataset_sample_ids_set)) == 0:
            raise UserError(
                "No cell lines in common between in-group and dataset selected"
            )
        if len(out_group_sample_ids.intersection(dataset_sample_ids_set)) == 0:
            raise UserError(
                "No cell lines in common between out-group and dataset selected"
            )

    elif (
        analysis_type == models.AnalysisType.pearson
        or analysis_type == models.AnalysisType.association
    ):
        assert query_series is not None
        assert query_series.shape[1] == 1
        model_query_vector, value_query_vector = _subset_feature_df(
            query_series.iloc[:, 0], depmap_model_ids
        )

    else:
        raise ValueError(f"Unexpected analysis type {analysis_type}")

    query = pd.Series(value_query_vector, index=model_query_vector)
    common_models = dataset_sample_ids_set.intersection(query.index)
    common_models_series = dataset_samples_df.given_id[
        dataset_samples_df.given_id.isin(cast(Sequence, common_models))
    ]
    assert isinstance(common_models_series, pd.Series)
    common_models_series.sort_index(inplace=True)
    query = query.loc[common_models_series.to_list()]

    return query, common_models_series.index, len(dataset_sample_ids_set)


# returns a set of features and their indices in the same order such the features[i] corresponds to indices[i]
def get_features_info_and_dataset(
    db: SessionWithUser,
    user: str,
    dataset_id: str,
    feature_filter_labels: Optional[List[str]] = None,
):
    dataset = dataset_crud.get_dataset(db, user, dataset_id)

    if dataset is None:
        raise ResourceNotFoundError(f"Dataset '{dataset_id}' not found.")

    assert isinstance(dataset, MatrixDataset)

    feature_labels_by_id = metadata_service.get_matrix_dataset_feature_labels_by_id(
        db, db.user, dataset
    )

    # filter by label if necessary (used by custom downloads)
    filter_by_feature_given_ids = None
    if feature_filter_labels is not None:
        filter_by_feature_given_ids = set()
        given_id_by_label = {
            label: given_id for given_id, label in feature_labels_by_id.items()
        }
        for label in feature_filter_labels:
            given_id = given_id_by_label.get(label)
            if given_id is not None:
                filter_by_feature_given_ids.add(given_id)

    dataset_features_df = get_matrix_dataset_features_df(
        db, dataset, filter_by_feature_given_ids
    )

    # drop any records which don't have a label (indicating the given_id is not registered as valid in the feature type)
    dataset_features_df = dataset_features_df[
        dataset_features_df.given_id.isin(feature_labels_by_id)
    ]

    # populate slice_id and label columns based on given_id
    dataset_features_df["slice_id"] = [
        _format_breadbox_shim_slice_id(dataset.id, given_id)
        for given_id in dataset_features_df.given_id
    ]

    dataset_features_df["label"] = [
        feature_labels_by_id[given_id] for given_id in dataset_features_df.given_id
    ]

    # HDF5 indexing requires that when slicing out by index, the indices are sorted. I personally
    # would prefer to handle this inside of our code for reading from HDF5 so we don't have to worry
    # about that -- but we are addressing an issue at the moment and I want to mimize the impact of
    # changes right now. So, we'll sort feature_indices and reorder result_features to match

    assert isinstance(dataset_features_df, pd.DataFrame)
    final_features_df = FeaturesExtDataFrame(dataset_features_df.sort_values(["index"]))
    return final_features_df, dataset


class UpdateMessageCallback:
    def __init__(self, task):
        self.task = task
        self.last_state_update = {
            "start_time": time.time(),
            "message": "Beginning calculations...",
        }

    def update_message(
        self, message=None, start_time=None, max_time: int = 45, percent_complete=None
    ):
        """
        :start_time: the presence of this is used to determine whether we show a progress presented
        :max_time: used to calculate to the end of a fake gloating bar
        """
        # remember the value used for the last update_message so that we don't have to pass all the parameters every time.

        if message is not None:
            self.last_state_update["message"] = message
        if start_time is not None:
            self.last_state_update["start_time"] = start_time
        self.last_state_update["max_time"] = max_time
        self.last_state_update["percent_complete"] = percent_complete

        if not self.task.request.called_directly:
            self.task.update_state(
                state="PROGRESS", meta=self.last_state_update,
            )


class CustomAnalysisCallbacksImpl:
    def __init__(
        self,
        user,
        dataset,
        sample_matrix_indices: List[int],
        filestore_location: str,
        update_message_callback: UpdateMessageCallback,
    ):
        self.user = user
        self.sample_matrix_indices = sample_matrix_indices
        self.dataset = dataset
        self.filestore_location = filestore_location
        self.update_message_callback = update_message_callback

    def update_message(
        self, message=None, start_time=None, max_time: int = 45, percent_complete=None
    ):
        self.update_message_callback.update_message(
            message=message,
            start_time=start_time,
            max_time=max_time,
            percent_complete=percent_complete,
        )

    def create_cell_line_group(
        self, model_ids: List[str], use_feature_ids: bool
    ) -> str:
        return create_cell_line_group(self.user, model_ids, use_feature_ids)

    def get_dataset_df(self, feature_matrix_indices: List[int]) -> np.ndarray:
        assert is_increasing(
            feature_matrix_indices
        ), "Feature matrix indices out of order"
        assert is_increasing(
            self.sample_matrix_indices
        ), "Sample matrix indices out of order"
        m = get_slice(
            self.dataset,
            feature_matrix_indices,
            self.sample_matrix_indices,
            self.filestore_location,
            keep_nans=True,
        )
        m_values = m.values
        assert m_values.dtype == np.dtype("float64")
        return m_values


def is_increasing(values: Sequence):
    prev = None
    for value in values:
        if prev is not None:
            if prev >= value:
                return False
        prev = value
    return True


@contextmanager
def no_op_ctx():
    yield


@app.task(base=LogErrorsTask, bind=True)
def run_custom_analysis(
    self,
    user: str,
    analysis_type: str,  # pearson, association, or two_class
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

    update_message_callback = UpdateMessageCallback(self)

    if self.request.called_directly:
        task_id = "called_directly"
    else:
        task_id = self.request.id

    update_message_callback.update_message("Fetching data")

    with db_context(user) as db:
        # All features and feature_indices for the dataset we're searching in
        features_df, dataset = get_features_info_and_dataset(db, user, dataset_id)
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
            if query_feature_id and query_dataset_id:
                # The query_feature_id is a given ID
                feature = get_dataset_feature_by_given_id(
                    db, query_dataset_id, query_feature_id
                )
                assert feature.index is not None, index_error_msg(feature)
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
            filtered_query,
            sample_matrix_indices,
            dataset_sample_count,
        ) = _get_filtered_query_feature(
            db, analysis_type, dataset, query_series, depmap_model_ids, query_values,
        )
        if len(filtered_query) == 0:
            raise UserError(
                "No cell lines in common between query and dataset searched"
            )

        filtered_query_values_list = filtered_query.to_list()
        filtered_cell_line_list = filtered_query.index.to_list()
        features_per_batch = (
            10 * 1024 ** 2 // (dataset_sample_count * 8)
        )  # aim for 10MB per batch

        parameters = dict(
            datasetId=dataset_id,
            query=dict(
                analysisType=analysis_type,
                queryFeatureId=query_feature_id,
                queryDatasetId=query_dataset_id,
                queryValues=filtered_query_values_list,
                vectorIsDependent=vector_is_dependent,
                queryCellLines=filtered_cell_line_list,
            ),
        )

        callbacks = CustomAnalysisCallbacksImpl(
            user,
            dataset,
            sample_matrix_indices.to_list(),
            filestore_location,
            update_message_callback,
        )

        result = analysis_tasks_interface.run_custom_analysis(
            task_id,
            analysis_type=analysis_type,
            depmap_model_ids=filtered_cell_line_list,
            value_query_vector=filtered_query_values_list,
            features_df=features_df,
            feature_type=feature_type_name,
            vector_is_dependent=vector_is_dependent,
            parameters=parameters,
            result_dir=results_dir,
            callbacks=callbacks,
            use_feature_ids=True,
            features_per_batch=features_per_batch,
        )

        return result


def _create_csv_file(feature_ids, sample_ids, values):

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
