import os
import csv
from io import StringIO
from depmap.dataset.models import Mutation, TabularDataset
from depmap.download.utils import get_download_url
from oauth2client.service_account import ServiceAccountCredentials
from typing import List
from datetime import datetime
from flask import request, current_app, make_response
from flask_restplus import Namespace, Resource, fields

from depmap import data_access
from depmap.download import tasks
from depmap.download.models import (
    DownloadRelease,
    BucketUrl,
)
from depmap.utilities.sign_bucket_url import sign_url
from depmap.celery_task.utils import format_task_status, task_response_model
from depmap.settings.download_settings import get_download_list
from depmap.gene.models import Gene, GeneExecutiveInfo
import pandas as pd
from depmap.partials.views import format_csv_response
from depmap.utilities.data_access_log import log_dataset_access, log_feature_access
from depmap.utilities.data_access_log import log_bulk_download_csv

namespace = Namespace("download", description="Download data in the portal")


@namespace.route("/files")
class BulkFilesCsv(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        # Note: docstrings to restplus methods end up in the swagger documentation.
        # DO NOT put a docstring here that you would not want exposed to users of the API. Use # for comments instead
        """
        Download a csv table listing all files available for download and links to download them
        """
        # Generate csv table which contains signed urls for fetching all the data files
        # This was written primarily in response to DMC requests for a way to bulk access all downloads.
        log_bulk_download_csv()
        show_taiga = current_app.config["SHOW_TAIGA_IN_BULK_DOWNLOADS"]
        credentials = ServiceAccountCredentials.from_json_keyfile_name(
            current_app.config["DOWNLOADS_KEY"]
        )
        downloads: List[DownloadRelease] = get_download_list()

        records = []
        expiry_seconds = 60 * 60 * 24 * 14  # links expire after two weeks

        for download in downloads:
            for file in download.all_files:
                if isinstance(file._url, BucketUrl):
                    url = sign_url(
                        credentials,
                        file._url.bucket,
                        file._url.file_name,
                        # extension_headers=extension_headers,
                        expiry_seconds=expiry_seconds,
                        dl_name=file._url.dl_name,
                    )
                elif isinstance(file._url, str):
                    url = file._url
                elif not show_taiga:
                    continue
                else:
                    url = None

                if show_taiga:
                    taiga_id = file.original_taiga_id
                    records.append(
                        [
                            download.name,
                            download.get_release_date(file),
                            file.name,
                            url,
                            taiga_id,
                            file.md5_hash,
                        ]
                    )
                else:
                    assert url is not None
                    records.append(
                        [
                            download.name,
                            download.get_release_date(file),
                            file.name,
                            url,
                            file.md5_hash,
                        ]
                    )

        sout = StringIO()
        w = csv.writer(sout)
        if show_taiga:
            w.writerow(
                ["release", "release_date", "filename", "url", "taiga_id", "md5_hash"]
            )
        else:
            w.writerow(["release", "release_date", "filename", "url", "md5_hash"])
        for rec in records:
            w.writerow(rec)
        headers = {
            "Content-Disposition": "attachment; filename=downloads.csv",
            "Content-type": "text/csv",
        }
        return make_response((sout.getvalue(), headers))


@namespace.route("/mutation_table_citation")
class MutationTableCitation(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    @namespace.doc(
        description="This API allows you to fetch the Mutation Table citation url.",
        params={
            "download_entry_url": {
                "description": "url to the mutation dataset information on Depmap's download page",
                "type": "string",
            },
        },
    )
    def get(self):
        # Note: docstrings to restplus methods end up in the swagger documentation.
        # DO NOT put a docstring here that you would not want exposed to users of the API. Use # for comments instead
        """
        List datasets that are available for custom download
        """
        return get_mutation_table_citation()


def get_mutation_table_citation():
    dataset = TabularDataset.get_by_name(
        TabularDataset.TabularEnum.mutation.name, must=False
    )
    download_url = get_download_url(dataset.taiga_id)

    return download_url


@namespace.route("/datasets")
class Datasets(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    @namespace.marshal_with(
        namespace.model(
            "Dataset",
            {
                "id": fields.String(description="dataset id"),
                "display_name": fields.String(description="dataset display name"),
                "data_type": fields.String(
                    description="label describing how datasets are grouped"
                ),
                "download_entry_url": fields.String(
                    description="url to the dataset information on Depmap's download page"
                ),
            },
        ),
        as_list=True,
    )
    def get(self):
        # Note: docstrings to restplus methods end up in the swagger documentation.
        # DO NOT put a docstring here that you would not want exposed to users of the API. Use # for comments instead
        """
        List datasets that are available for custom download
        """
        return get_datasets()


def get_datasets():
    dataset_list = []
    for dataset_id in data_access.get_all_matrix_dataset_ids():
        if data_access.is_continuous(dataset_id):
            taiga_id = data_access.get_dataset_taiga_id(dataset_id)
            dataset_url = get_download_url(taiga_id) if taiga_id else None
            dataset_list.append(
                {
                    "id": dataset_id,
                    "display_name": data_access.get_dataset_label(dataset_id),
                    "data_type": data_access.get_dataset_data_type(dataset_id),
                    "download_entry_url": dataset_url,
                }
            )
    return dataset_list


@namespace.route("/custom_mutation_table")
class ExportMutationTable(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    @namespace.doc(
        description='This API allows you to download the Mutation Table with optional subsetting. It returns a task id that should be used to query /api/task/{id}. When the task state returns SUCCESS, "result" has the structure {"downloadUrl": string}, where the string is the URL at which to download the file. For this task, percentComplete will always return null.',
        params={
            "featureLabels": {
                "description": "A list of genes to subset the mutation table by.  If null, return all features in the mutation table.",
                "type": "list",
                "default": None,
            },
            "cellLineIds": {
                "description": "A list of cell line depmap ID's to subset datasets by.  If null, return all cell lines in the mutation table.",
                "type": "list",
                "default": None,
            },
        },
    )
    @namespace.marshal_with(namespace.model("Task", task_response_model))
    def post(self):
        # Note: docstrings to restplus methods end up in the swagger documentation.
        # This docstring is used for a short one-line description shown next to the endpoint URL. Longer descriptions should go in namespace.doc(description=)
        # DO NOT put a docstring here that you would not want exposed to users of the API. Use # for comments instead
        """
        Submit a task to download a custom subset the mutation table
        """
        entity_labels = request.json.get("featureLabels")
        cell_lines = request.json.get("cellLineIds")

        result_dir = os.path.join(
            current_app.config["COMPUTE_RESULTS_ROOT"],
            str(datetime.now().strftime("%Y%m%d")),
        )

        from depmap.access_control import get_current_user_for_access_control

        result = tasks.export_mutation_table_subset.delay(
            entity_labels,
            cell_lines,
            result_dir,
            get_current_user_for_access_control(),
        )
        return format_task_status(result)


@namespace.route("/custom")
class ExportDataset(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    @namespace.doc(
        description='This API allows you to down boat as subset of a dataset. It returns a task id that should be used to query /api/task/{id}. When the task state returns SUCCESS, "result" has the structure {"downloadUrl": string}, where the string is the URL at which to download the file. For this task, percentComplete will always return null.',
        params={
            "datasetId": {
                "description": "The ID of the dataset to download",
                "type": "string",
                "required": True,
                # filling in "example" doesn't seem to do anything
            },
            "featureLabels": {
                "description": "A list of gene or compound labels to subset the selected dataset by.  If null, return all features in the dataset.",
                "type": "list",
                "default": None,
            },
            "cellLineIds": {
                "description": "A list of cell line depmap ID's to subset datasets by.  If null, return all cell lines in the dataset.",
                "type": "list",
                "default": None,
            },
            "dropEmpty": {
                "description": "If true, rows and columns will be dropped if the entire row or entire column only contains NAs.",
                "type": "boolean",
                "default": False,
            },
            "addCellLineMetadata": {
                "description": "If true, add cell line metadata (name, lineages) to csv .",
                "type": "boolean",
                "default": False,
            },
        },
    )
    @namespace.marshal_with(namespace.model("Task", task_response_model))
    def post(self):
        # Note: docstrings to restplus methods end up in the swagger documentation.
        # This docstring is used for a short one-line description shown next to the endpoint URL. Longer descriptions should go in namespace.doc(description=)
        # DO NOT put a docstring here that you would not want exposed to users of the API. Use # for comments instead
        """
        Submit a task to download a custom subset of a dataset
        """
        dataset_id = request.json.get("datasetId")
        entity_labels = request.json.get("featureLabels")
        cell_lines = request.json.get("cellLineIds")
        drop_nas = request.json.get("dropEmpty")
        add_cell_line_metadata = request.json.get("addCellLineMetadata")

        if entity_labels and len(entity_labels) < 10:
            for entity_label in entity_labels:
                log_feature_access("ExportDataset.post", dataset_id, entity_label)
        else:
            log_dataset_access("ExportDataset.post", dataset_id)

        assert dataset_id is not None

        result_dir = os.path.join(
            current_app.config["COMPUTE_RESULTS_ROOT"],
            str(datetime.now().strftime("%Y%m%d")),
        )

        from depmap.access_control import get_current_user_for_access_control

        result = tasks.export_dataset.delay(
            dataset_id,
            entity_labels,
            cell_lines,
            drop_nas,
            add_cell_line_metadata,
            result_dir,
            get_current_user_for_access_control(),
        )
        return format_task_status(result)


@namespace.route("/custom_merged")
class ExportMergedDataset(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    @namespace.doc(
        description='This API allows you to download 2 or more datasets merged into a single file by depmap_id. It returns a task id that should be used to query /api/task/{id}. When the task state returns SUCCESS, "result" has the structure {"downloadUrl": string}, where the string is the URL at which to download the file. For this task, percentComplete will always return null.',
        params={
            "datasetIds": {
                "description": "The ID of the dataset to download",
                "type": "list",
                "required": True,
                # filling in "example" doesn't seem to do anything
            },
            "featureLabels": {
                "description": "A list of gene or compound labels to subset the selected dataset by.  If null, return all features in the dataset.",
                "type": "list",
                "default": None,
            },
            "cellLineIds": {
                "description": "A list of cell line depmap ID's to subset datasets by.  If null, return all cell lines in the dataset.",
                "type": "list",
                "default": None,
            },
            "dropEmpty": {
                "description": "If true, rows and columns will be dropped if the entire row or entire column only contains NAs.",
                "type": "boolean",
                "default": False,
            },
            "addCellLineMetadata": {
                "description": "If true, add cell line metadata (name, lineages) to csv .",
                "type": "boolean",
                "default": False,
            },
        },
    )
    @namespace.marshal_with(namespace.model("Task", task_response_model))
    def post(self):
        # Note: docstrings to restplus methods end up in the swagger documentation.
        # This docstring is used for a short one-line description shown next to the endpoint URL. Longer descriptions should go in namespace.doc(description=)
        # DO NOT put a docstring here that you would not want exposed to users of the API. Use # for comments instead
        """
        Submit a task to download a custom merge of 2 or more datasets
        """
        dataset_ids = request.json.get("datasetIds")
        entity_labels = request.json.get("featureLabels")
        cell_lines = request.json.get("cellLineIds")
        drop_nas = request.json.get("dropEmpty")
        add_cell_line_metadata = request.json.get("addCellLineMetadata")

        for dataset_id in dataset_ids:
            if entity_labels and len(entity_labels) < 10:
                for entity_label in entity_labels:
                    log_feature_access(
                        "ExportMergedDataset.post", dataset_id, entity_label
                    )
            else:
                log_dataset_access("ExportMergedDataset.post", dataset_id)

        assert dataset_id is not None

        assert len(dataset_ids) > 1

        result_dir = os.path.join(
            current_app.config["COMPUTE_RESULTS_ROOT"],
            str(datetime.now().strftime("%Y%m%d")),
        )

        from depmap.access_control import get_current_user_for_access_control

        result = tasks.export_merged_datasets.delay(
            dataset_ids,
            entity_labels,
            cell_lines,
            drop_nas,
            add_cell_line_metadata,
            result_dir,
            get_current_user_for_access_control(),
        )

        return format_task_status(result)


@namespace.route("/gene_dep_summary")
class GeneDependencySummary(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    @namespace.doc(
        description="This API allows you to download the dependency summary for all genes as a csv.",
    )
    def get(self):
        query = GeneExecutiveInfo.query.join(Gene).add_columns(
            Gene.entrez_id, Gene.label
        )
        df = pd.read_sql(query.statement, query.session.connection())
        df.drop(
            columns=["gene_executive_info_id", "gene_id", "is_dropped_by_chronos"],
            inplace=True,
        )
        cols = df.columns.tolist()
        # Reorder the columns so gene table columns are first
        reordered_cols = cols[-2:] + cols[:-2]
        df = df[reordered_cols]
        df.rename(
            columns={
                "entrez_id": "Entrez Id",
                "label": "Gene",
                "dataset": "Dataset",
                "num_dependent_cell_lines": "Dependent Cell Lines",
                "num_lines_with_data": "Cell Lines with Data",
                "is_strongly_selective": "Strongly Selective",
                "is_common_essential": "Common Essential",
            },
            inplace=True,
        )
        # Replace None/Nan values
        replacement_vals = {
            "Strongly Selective": False,
            "Common Essential": False,
            "Cell Lines with Data": 0,
            "Dependent Cell Lines": 0,
        }
        df.fillna(value=replacement_vals, inplace=True)
        return format_csv_response(
            df, "Gene Dependency Profile Summary", {"index": False},
        )
