from datetime import datetime
import os
from typing import Any, Callable, Dict, List, Optional, Tuple

import pandas as pd

from breadbox.db.session import SessionWithUser
from breadbox.compute.analysis_tasks import get_features_info_and_dataset
from breadbox.io.filestore_crud import get_slice
from breadbox.schemas.custom_http_exception import UserError
from breadbox.crud.dataset import get_sample_indexes_by_given_ids
from breadbox.crud.dataset import get_all_sample_indexes
from breadbox.crud.partial import get_cell_line_selector_lines
from ..config import get_settings
from ..models.dataset import (
    Dataset,
    MatrixDataset,
    DatasetFeature,
    ValueType,
)
from .celery import app, LogErrorsTask
from ..db.util import db_context
from breadbox.service import metadata as metadata_service


def _progress_callback(task, percentage, message="Fetching data"):
    last_state_update = {"message": message, "percent_complete": percentage}
    task.update_state(
        state="PROGRESS", meta=last_state_update,
    )


def _make_result_task_directory(result_dir: str, task_id: str):
    result_task_dir = os.path.join(result_dir, task_id)
    os.makedirs(result_task_dir)
    return result_task_dir


def chunk_iter(seq, length):
    batch = []
    for x in seq:
        batch.append(x)
        if len(batch) >= length:
            yield batch
            batch = []

    if len(batch) > 0:
        yield batch


def _get_subsetted_df_by_indexes(
    db: SessionWithUser,
    dataset: MatrixDataset,
    filestore_location: str,
    feature_indexes: Optional[List[int]],
    sample_indexes: Optional[List[int]],
    user: str,
    include_dataset_name_in_row_name: Optional[bool] = False,
):
    # Given a dataset id, sample indices, and feature indices, get the dataframe
    # of the dataset that just has those ids
    if dataset.value_type == ValueType.continuous:
        subsetted_df = get_slice(
            dataset, feature_indexes, sample_indexes, filestore_location
        )

        # Only include dataset names in column names if we're merging datasets
        col_rename_map = {}

        feature_labels = metadata_service.get_matrix_dataset_feature_labels_by_id(
            db, user, dataset
        )

        for col in subsetted_df.columns:
            if include_dataset_name_in_row_name:
                col_rename_map[col] = f"{dataset.name} {feature_labels.get(col, col)}"
            else:
                col_rename_map[col] = f"{feature_labels.get(col, col)}"

        subsetted_df.rename(columns=col_rename_map, inplace=True)

        return subsetted_df
    else:
        raise NotImplementedError


def get_processed_df(
    db: SessionWithUser,
    dataset: Dataset,
    filestore_location: str,
    feature_indices: List[int],
    sample_indices: List[int],
    progress_callback: Callable[[int], None],
    user: str,
    chunk_size=1000,
):
    """
    Get df in chunks and update task percent completion
    """
    df_chunks = []
    # 90% arbitrarily assigned to reading the data
    max_percent = 90

    chunks = list(chunk_iter(feature_indices, chunk_size))
    num_chunks = len(chunks)

    for i, chunk in enumerate(chunks):
        df = _get_subsetted_df_by_indexes(
            db=db,
            dataset=dataset,
            filestore_location=filestore_location,
            feature_indexes=chunk,
            sample_indexes=sample_indices,
            user=user,
        )
        df = df.transpose()
        df_chunks.append(df)
        # Calculte percentage of processed rows/chunks
        percentage = (min((i + 1) / num_chunks, 1)) * max_percent
        # Update task percent completion
        progress_callback(int(percentage))

    if len(df_chunks) == 0:
        raise UserError(
            "The chosen genes, compounds, or cell lines do not exist in this dataset. Nothing to export."
        )

    df = pd.concat(df_chunks)
    df = df.transpose()
    return df


def _estimate_result_size(datasets, sample_indices, feature_indices):
    size_estimate = 0
    assert sample_indices != None

    assert len(feature_indices) == len(datasets)

    for i, dataset_id in enumerate(datasets):
        rows = len(sample_indices)
        columns = len(feature_indices[i])
        size_estimate += rows * columns

    return size_estimate


def get_merged_processed_df(
    db: SessionWithUser,
    datasets: List[Dataset],
    filestore_location: str,
    feature_indices: List[List[int]],
    sample_indices: List[int],
    progress_callback: Callable[[int], None],
    user: str,
    chunk_size=1000,
):
    """
    Get df in chunks and update task percent completion
    """
    df_chunks = []
    # 90% arbitrarily assigned to reading the data
    max_percent = 90

    chunks = []

    for feature_index_list in feature_indices:
        chunks.extend(list(chunk_iter(feature_index_list, chunk_size)))

    num_chunks = len(chunks)
    total_chunk_counter = 0

    estimated_size = _estimate_result_size(datasets, sample_indices, feature_indices)
    if (
        estimated_size > 4000000
    ):  # NOTE: Many datasets are large to be merged... TODO: New estimate needed?
        raise UserError("File is too large to download.")

    for i, feature_indices_list in enumerate(feature_indices):
        chunks = list(chunk_iter(feature_indices[i], chunk_size))
        for chunk in chunks:
            df = _get_subsetted_df_by_indexes(
                db=db,
                dataset=datasets[i],
                filestore_location=filestore_location,
                feature_indexes=chunk,
                sample_indexes=sample_indices,
                user=user,
                include_dataset_name_in_row_name=True,
            )
            df = df.transpose()
            df_chunks.append(df)

            # Calculte percentage of processed rows/chunks
            total_chunk_counter = total_chunk_counter + 1
            percentage = (min((total_chunk_counter + 1) / num_chunks, 1)) * max_percent
            # Update task percent completion
            progress_callback(int(percentage))

    if len(df_chunks) == 0:
        raise UserError(
            "The chosen genes, compounds, or cell lines do not exist in the selected datasets. Nothing to export."
        )

    df = pd.concat(df_chunks)

    df = df.transpose()

    return df


def _get_filename_for_user(
    file_name: str,
    nas_dropped: bool,
    feature_labels: Optional[List[str]],
    sample_ids: Optional[List[str]],
) -> str:
    filename_for_user = file_name

    if feature_labels is not None or sample_ids is not None:
        filename_for_user = filename_for_user + "_subsetted"

    if nas_dropped:
        filename_for_user = filename_for_user + "_NAsdropped"

    filename_for_user = (
        filename_for_user + ".csv"
    )  # ends in .csv is for the user, but also for morpheus requirements. see the docstring of the download.data_slicer_download endpoint

    return filename_for_user


def _add_metadata(db: SessionWithUser, df: pd.DataFrame) -> pd.DataFrame:
    metadata_df = get_cell_line_selector_lines(db)
    metadata_cols = ["cell_line_name"] + [
        col for col in metadata_df if col.startswith("lineage")
    ]
    metadata_df = metadata_df[metadata_cols]
    df = metadata_df.merge(df, left_index=True, right_index=True)

    return df


def _get_download_result(
    self,
    db: SessionWithUser,
    df: pd.DataFrame,
    add_metadata: bool,
    result_path: str,
    filename_for_user: str,
    compute_results_location: str,
) -> Dict[str, str]:
    if add_metadata:
        df = _add_metadata(db, df)

    # file should end up being saved as COMPUTE_RESULTS_LOCATION/<time>/<task_id>/export.csv
    #   time helps us for deleting results
    #   task_id provides security through non-guessability, since we send this to the front end
    #   naming the file export.csv instead of filename_for_user provides security to our local filesystem by always writing an expected and sane filename
    download_file_path = os.path.join(result_path, "export.csv")
    df.to_csv(download_file_path, index=True, header=True)

    # After writing to csv is considered full completion
    _progress_callback(self, percentage=100, message="Finished")

    # get the path of file relative to the result root, as a security measure
    file_path_from_compute_results_dir = os.path.relpath(
        download_file_path, start=os.path.join(compute_results_location)
    )

    from urllib.parse import urlencode

    params = {
        "file_path": file_path_from_compute_results_dir,
        "name": filename_for_user,
    }

    download_url = "/downloads/data_slicer/download?" + urlencode(params)

    result = {"downloadUrl": download_url}

    return result


def _handle_df_nas(
    drop_nas: bool,
    df: pd.DataFrame,
    column_labels: Optional[List[str]],
    cell_lines: Optional[List[str]],
):
    nas_dropped = False

    if drop_nas:
        df2 = df.dropna(axis=0, how="all")
        df2 = df2.dropna(axis=1, how="all")
        if df2.shape != df.shape:
            nas_dropped = True
        df = df2
    else:
        # populate cell lines and entities that were specified by the user but not in the dataset with NaN's
        if cell_lines:
            df = df.reindex(index=cell_lines)
        if column_labels is not None:
            df = df.reindex(columns=column_labels)

    return df, nas_dropped


def get_feature_and_sample_indices_per_merged_dataset(
    db: SessionWithUser,
    user: str,
    dataset_ids: List[str],
    given_ids: Optional[List[str]],
    feature_labels: Optional[List[str]],
) -> Tuple[List[List[int]], List[int], List[Dataset]]:
    feature_indices_per_dataset: List[List[int]] = []
    datasets: List[Dataset] = []
    for dataset_id in dataset_ids:
        feature_indices, dataset = get_features_info_and_dataset(
            db, user, dataset_id, feature_labels
        )

        feature_indices_per_dataset.append(feature_indices.index.to_list())
        datasets.append(dataset)

    sample_indices: List[int] = []
    if given_ids:
        sample_indices, missing_samples = get_sample_indexes_by_given_ids(
            db=db, user=user, dataset=datasets[0], given_ids=given_ids
        )
        # ignoring missing_samples to get original behavior
    else:
        sample_indices = get_all_sample_indexes(db=db, user=user, dataset=datasets[0])

    return feature_indices_per_dataset, sample_indices, datasets


@app.task(base=LogErrorsTask, bind=True)
def export_merged_datasets(
    self: Any,
    dataset_ids: List[str],
    feature_labels: Optional[List[str]],
    sample_ids: Optional[List[str]],
    drop_nas: bool,
    add_metadata: bool,
    result_dir: str,
    user: str,
):
    if self.request.called_directly:
        task_id = "called_directly"
    else:
        task_id = self.request.id

    _progress_callback(self, 0)

    result_path = _make_result_task_directory(result_dir, task_id)

    def progress_callback(percentage):
        # get_merged_processed_df needs a callback which doesn't take the task as a parameter
        _progress_callback(self, percentage)

    with db_context(user) as db:
        settings = get_settings()

        (
            feature_indices_per_dataset,
            sample_indices_per_dataset,
            datasets,
        ) = get_feature_and_sample_indices_per_merged_dataset(
            db=db,
            user=user,
            dataset_ids=dataset_ids,
            given_ids=sample_ids,
            feature_labels=feature_labels,
        )

        df = get_merged_processed_df(
            db=db,
            datasets=datasets,
            filestore_location=settings.filestore_location,
            feature_indices=feature_indices_per_dataset,
            sample_indices=sample_indices_per_dataset,
            progress_callback=progress_callback,
            user=user,
        )

        df, nas_dropped = _handle_df_nas(drop_nas, df, df.columns.values, sample_ids)

        file_name = f"depmap_export_{datetime.now()}"
        filename_for_user = _get_filename_for_user(
            file_name, nas_dropped, feature_labels, sample_ids
        )

        result = _get_download_result(
            self,
            db=db,
            df=df,
            add_metadata=add_metadata,
            result_path=result_path,
            filename_for_user=filename_for_user,
            compute_results_location=settings.compute_results_location,
        )

        return result


def _get_all_sample_indices(
    db, user: str, dataset: Dataset, given_ids: Optional[List[str]]
) -> List[int]:
    sample_indices = []
    if given_ids:
        sample_indices, missing_samples = get_sample_indexes_by_given_ids(
            db=db, user=user, dataset=dataset, given_ids=given_ids
        )
        # ignoring missing_samples to get original behavior
    else:
        sample_indices = get_all_sample_indexes(db=db, user=user, dataset=dataset)

    return sample_indices


@app.task(base=LogErrorsTask, bind=True)
def export_dataset(
    self: Any,
    dataset_id: str,
    feature_labels: Optional[List[str]],
    sample_ids: Optional[List[str]],
    drop_nas: bool,
    add_metadata: bool,
    result_dir: str,
    user: str,
):
    if self.request.called_directly:
        task_id = "called_directly"
    else:
        task_id = self.request.id

    _progress_callback(self, 0)

    result_path = _make_result_task_directory(result_dir, task_id)

    def progress_callback(percentage):
        # get_processed_df needs a callback which doesn't take the task as a parameter
        _progress_callback(self, percentage)

    with db_context(user) as db:
        settings = get_settings()

        # Get feature_indices using feature_labels as a filter
        feature_indices, dataset = get_features_info_and_dataset(
            db, user, dataset_id, feature_labels
        )

        # If sample_ids is None, this returns all sample_indices for the dataset
        sample_indices = _get_all_sample_indices(
            db=db, user=user, dataset=dataset, given_ids=sample_ids
        )

        df = get_processed_df(
            db=db,
            dataset=dataset,
            filestore_location=settings.filestore_location,
            feature_indices=feature_indices.index.to_list(),
            sample_indices=sample_indices,
            progress_callback=progress_callback,
            user=user,
        )

        df, nas_dropped = _handle_df_nas(drop_nas, df, df.columns.values, sample_ids)

        file_name = dataset.name.replace(" ", "_")
        filename_for_user = _get_filename_for_user(
            file_name, nas_dropped, feature_labels, sample_ids
        )

        result = _get_download_result(
            self,
            db=db,
            df=df,
            add_metadata=add_metadata,
            result_path=result_path,
            filename_for_user=filename_for_user,
            compute_results_location=settings.compute_results_location,
        )

        return result
