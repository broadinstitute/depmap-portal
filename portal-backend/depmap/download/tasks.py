from __future__ import absolute_import, unicode_literals
from datetime import datetime
from typing import Callable, Dict

import logging
import os
from typing import Any, Callable, List, Optional
from depmap.gene.models import Gene
from depmap.partials.data_table.factories import MutationTableSpec

import pandas as pd
from flask import current_app, url_for

from depmap import data_access
from depmap.access_control import assume_user
from depmap.cell_line.models import CellLine, Lineage
from depmap.compute.celery import app
from depmap.compute.analysis_tasks import make_result_task_directory
from depmap.utilities.exception import UserError
from depmap.utilities.iter import chunk_iter

log = logging.getLogger(__name__)


def _progress_callback(task, percentage, message="Fetching data"):
    last_state_update = {"message": message, "percent_complete": percentage}
    task.update_state(
        state="PROGRESS", meta=last_state_update,
    )


def _get_filename_for_user(
    file_name: str,
    nas_dropped: bool,
    entity_labels: Optional[List[str]],
    cell_lines: Optional[List[str]],
) -> str:
    filename_for_user = file_name

    if entity_labels is not None or cell_lines is not None:
        filename_for_user = filename_for_user + "_subsetted"

    if nas_dropped:
        filename_for_user = filename_for_user + "_NAsdropped"

    filename_for_user = (
        filename_for_user + ".csv"
    )  # ends in .csv is for the user, but also for morpheus requirements. see the docstring of the download.data_slicer_download endpoint

    return filename_for_user


def _add_cell_line_metadata(df: pd.DataFrame) -> pd.DataFrame:
    metadata_df = _get_cell_line_metadata_df()
    metadata_cols = ["cell_line_display_name"] + [
        col for col in metadata_df if col.startswith("lineage")
    ]
    metadata_df = metadata_df[metadata_cols]
    df = metadata_df.merge(df, left_index=True, right_index=True)
    df.index.name = "depmap_id"

    return df


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


def _get_mutation_table_entity_ids(entity_labels: List[str]):
    entity_ids = []
    for label in entity_labels:
        gene = Gene.get_by_label(label, must=False)
        if gene:
            entity_ids.append(gene.entity_id)

    return entity_ids


def _get_download_result(
    self,
    df: pd.DataFrame,
    add_cell_line_metadata: bool,
    result_path: str,
    filename_for_user: str,
) -> Dict[str, str]:
    if add_cell_line_metadata:
        df = _add_cell_line_metadata(df)
    # file should end up being saved as COMPUTE_RESULTS_ROOT/<time>/<task_id>/export.csv
    #   time helps us for deleting results
    #   task_id provides security through non-guessability, since we send this to the front end
    #   naming the file export.csv instead of filename_for_user provides security to our local filesystem by always writing an expected and sane filename
    download_file_path = os.path.join(result_path, "export.csv")
    df.to_csv(download_file_path, index=True, header=True)

    # After writing to csv is considered full completion
    _progress_callback(self, percentage=100, message="Finished")

    # get the path of file relative to the result root, as a security measure
    file_path_from_compute_results_dir = os.path.relpath(
        download_file_path, start=current_app.config["COMPUTE_RESULTS_ROOT"]
    )

    download_url = url_for(
        "download.data_slicer_download",
        file_path=file_path_from_compute_results_dir,  # as a security measure, send the path relative from the results dir, not from the filesystem root
        name=filename_for_user,  # see commend above for the distinction
    )

    result = {"downloadUrl": download_url}

    return result


@app.task(bind=True)
def export_merged_datasets(
    self: Any,
    dataset_ids: List[str],
    entity_labels: Optional[List[str]],
    cell_lines: Optional[List[str]],
    drop_nas: bool,
    add_cell_line_metadata: bool,
    result_dir: str,
    user_id: str,
):
    if self.request.called_directly:
        task_id = "called_directly"
    else:
        task_id = self.request.id

    _progress_callback(self, 0)

    with assume_user(user_id):
        result_path = make_result_task_directory(result_dir, task_id)
        entity_labels_lists: list[list[str]] = []

        for dataset_id in dataset_ids:
            if entity_labels:
                entity_labels_lists.append(entity_labels)
            else:
                entity_labels_lists.append(
                    data_access.get_dataset_feature_labels(dataset_id)
                )

        def progress_callback(percentage):
            # get_merged_processed_df needs a callback which doesn't take the task as a parameter
            _progress_callback(self, percentage)

        df = get_merged_processed_df(
            dataset_ids, entity_labels_lists, cell_lines, progress_callback
        )

        df, nas_dropped = _handle_df_nas(drop_nas, df, df.columns.values, cell_lines)

        file_name = f"depmap_export_{datetime.now()}"
        filename_for_user = _get_filename_for_user(
            file_name, nas_dropped, entity_labels, cell_lines
        )

        result = _get_download_result(
            self, df, add_cell_line_metadata, result_path, filename_for_user
        )

        return result


def get_processed_mutations_df(
    entity_ids, cell_lines, progress_callback: Callable[[int], None], chunk_size=1000,
):
    """
    Get df in chunks and update task percent completion
    """
    df_chunks = []
    # 90% arbitrarily assigned to reading the data
    max_percent = 90
    chunks = list(chunk_iter(entity_ids, chunk_size))
    num_chunks = len(chunks)

    for i, chunk in enumerate(chunks):
        df = MutationTableSpec.get_subsetted_mutations_df_by_ids(chunk, cell_lines)
        df_chunks.append(df)
        # Calculte percentage of processed rows/chunks
        percentage = (min((i + 1) / num_chunks, 1)) * max_percent
        # Update task percent completion
        progress_callback(int(percentage))

    if len(df_chunks) == 0:
        raise UserError(
            "The chosen genes or cell lines do not exist in the Mutation Table. Nothing to export."
        )

    df = pd.concat(df_chunks)
    df = df.transpose()

    return df


@app.task(bind=True)
def export_mutation_table_subset(
    self: Any,
    entity_labels: Optional[List[str]],
    cell_lines: Optional[List[str]],
    result_dir: str,
    user_id: str,
):
    if self.request.called_directly:
        task_id = "called_directly"
    else:
        task_id = self.request.id

    _progress_callback(self, 0)

    with assume_user(user_id):
        result_path = make_result_task_directory(result_dir, task_id)

        entity_ids = []
        if entity_labels:
            entity_ids = _get_mutation_table_entity_ids(entity_labels=entity_labels)
        else:
            entity_ids = MutationTableSpec.get_all_mutation_gene_ids()

        def progress_callback(percentage):
            # get_processed_df needs a callback which doesn't take the task as a parameter
            _progress_callback(self, percentage)

        df = get_processed_mutations_df(
            entity_ids=entity_ids,
            cell_lines=cell_lines,
            progress_callback=progress_callback,
        )
        df = df.transpose()

        file_name = "mutations"
        filename_for_user = _get_filename_for_user(
            file_name, True, entity_labels, cell_lines
        )

        result = _get_download_result(self, df, False, result_path, filename_for_user)
        return result


@app.task(bind=True)
def export_dataset(
    self: Any,
    dataset_id: str,
    entity_labels: Optional[List[str]],
    cell_lines: Optional[List[str]],
    drop_nas: bool,
    add_cell_line_metadata: bool,
    result_dir: str,
    user_id: str,
):
    if self.request.called_directly:
        task_id = "called_directly"
    else:
        task_id = self.request.id
    _progress_callback(self, 0)
    with assume_user(user_id):
        result_path = make_result_task_directory(result_dir, task_id)
        if not entity_labels:
            entity_labels = data_access.get_dataset_feature_labels(dataset_id)

        def progress_callback(percentage):
            # get_processed_df needs a callback which doesn't take the task as a parameter
            _progress_callback(self, percentage)

        df = get_processed_df(dataset_id, entity_labels, cell_lines, progress_callback)

        df, nas_dropped = _handle_df_nas(drop_nas, df, entity_labels, cell_lines)

        file_name = data_access.get_dataset_label(dataset_id).replace(" ", "_")
        filename_for_user = _get_filename_for_user(
            file_name, nas_dropped, entity_labels, cell_lines
        )

        result = _get_download_result(
            self, df, add_cell_line_metadata, result_path, filename_for_user
        )
        return result


def get_processed_df(
    dataset_id,
    entity_labels,
    cell_lines,
    progress_callback: Callable[[int], None],
    chunk_size=1000,
):
    """
    Get df in chunks and update task percent completion
    """
    df_chunks = []
    # 90% arbitrarily assigned to reading the data
    max_percent = 90
    chunks = list(chunk_iter(entity_labels, chunk_size))
    num_chunks = len(chunks)

    for i, chunk in enumerate(chunks):
        df = data_access.get_subsetted_df_by_labels(dataset_id, chunk, cell_lines)
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


def _estimate_result_size(dataset_ids, cell_lines, entity_labels):
    size_estimate = 0

    for i, dataset_id in enumerate(dataset_ids):
        rows = (
            len(cell_lines)
            if cell_lines is not None
            else len(data_access.get_dataset_sample_ids(dataset_id))
        )
        columns = (
            len(entity_labels[i])
            if entity_labels is not None
            else len(data_access.get_dataset_feature_labels(dataset_id))
        )
        size_estimate += rows * columns

    return size_estimate


def get_merged_processed_df(
    dataset_ids,
    entity_labels: list[list[str]],
    cell_lines,
    progress_callback: Callable[[int], None],
    chunk_size=1000,
):
    """
    Get df in chunks and update task percent completion
    """
    df_chunks = []
    # 90% arbitrarily assigned to reading the data
    max_percent = 90

    chunks = []

    for entity_label_list in entity_labels:
        chunks.extend(list(chunk_iter(entity_label_list, chunk_size)))

    num_chunks = len(chunks)
    total_chunk_counter = 0

    estimated_size = _estimate_result_size(dataset_ids, cell_lines, entity_labels)
    if estimated_size > 4000000:
        raise UserError("File is too large to download.")

    for i, dataset_id in enumerate(dataset_ids):
        chunks = list(chunk_iter(entity_labels[i], chunk_size))
        for chunk in chunks:
            df = data_access.get_subsetted_df_by_labels(dataset_id, chunk, cell_lines)
            df = _add_dataset_name_to_df_row_names(df, dataset_id)

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


def _add_dataset_name_to_df_row_names(df, dataset_id):
    dataset_name = data_access.get_dataset_label(dataset_id)
    index_name_mapping = {}
    for row_index in df.index:
        index_name_mapping[row_index] = f"{dataset_name} {row_index}"
    return df.rename(index=index_name_mapping)


def _get_cell_line_metadata_df():
    query = CellLine.get_cell_line_metadata_query()
    df = pd.read_sql(query.statement, query.session.connection())
    df["lineage"] = df["lineage"].apply(Lineage.get_display_name)
    df["lineage_level"] = "lineage_" + df["lineage_level"].astype(str)
    inds = df.columns.difference(["lineage_level", "lineage"]).tolist()
    dummy_value = ""
    df = df.fillna(dummy_value)
    df = df.pivot_table(
        index=inds, columns="lineage_level", values="lineage", aggfunc="first"
    )
    df = df.replace(dummy_value, None)
    df = df.reset_index()
    # ensure that all 4 lineage columns are returned
    for i in range(4):
        column_name = "lineage_{}".format(i + 1)
        if column_name not in df.columns:
            df[column_name] = [None] * len(df.index)
    df = df.set_index("depmap_id")
    return df
