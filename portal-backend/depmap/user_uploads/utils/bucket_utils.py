# -*- coding: utf-8 -*-
import dataclasses
from dataclasses import dataclass
from typing import Optional
import logging
import io
from depmap.enums import DataTypeEnum
import pandas as pd
from typing import List, Dict, Tuple
from google.cloud import storage
from flask import current_app

from depmap.database import db
from depmap.interactive.nonstandard.models import (
    NonstandardMatrix,
    PrivateDatasetMetadata,
)
from typeguard import typechecked
import typing

PRIVATE_DATASETS_BUCKETS_BY_ENV = {
    "iqa": "depmap-internal-private-datasets",
    "istaging": "depmap-internal-private-datasets",
    "iprod": "depmap-internal-private-datasets",
    "dqa": "depmap-dmc-private-datasets",
    "dstaging": "depmap-dmc-private-datasets",
    "dprod": "depmap-dmc-private-datasets",
    "pstaging": "depmap-peddep-private-datasets",
    "pprod": "depmap-peddep-private-datasets",
    "dev": "depmap-dev-private-datasets",
    "test": "depmap-dev-private-datasets",
    "test-dev": "depmap-dev-private-datasets",
}

# Staging and prod need to use the same folders (or really, master file) or else prod will use the staging version after deploying
PRIVATE_DATASETS_FOLDERS_OVERRIDES = {
    "dstaging": "dprod",
    "istaging": "iprod",
    "pstaging": "pprod",
}

# To change the format of this file, changes must be made to this file on the google bucket for every environment
PRIVATE_DATASETS_MAP_FILE = "_MASTER_MAP.csv"


@dataclass
class UserUploadRecord:
    dataset_id: str
    dataset: str
    display_name: str
    units: str
    feature_name: str
    owner_id: int
    data_type: str = DataTypeEnum.user_upload.name
    is_transpose: bool = True
    cell_line_name_type: str = "depmap_id"
    priority: Optional[int] = None


log = logging.getLogger(__name__)


def _get_private_datasets_client() -> storage.Client:
    client = storage.Client.from_service_account_json(
        current_app.config["DOWNLOADS_KEY"]
    )
    return client


def _get_private_datasets_bucket(client: storage.Client = None) -> storage.Bucket:
    if client is None:
        client = _get_private_datasets_client()
    assert current_app.config["ENV"] in PRIVATE_DATASETS_BUCKETS_BY_ENV
    bucket_name = PRIVATE_DATASETS_BUCKETS_BY_ENV[current_app.config["ENV"]]
    bucket = client.bucket(bucket_name)
    return bucket


def _get_private_datasets_file(
    file_name: str, bucket: storage.Bucket = None
) -> storage.Blob:
    if bucket is None:
        bucket = _get_private_datasets_bucket()

    env = current_app.config["ENV"]

    folder = (
        PRIVATE_DATASETS_FOLDERS_OVERRIDES[env]
        if env in PRIVATE_DATASETS_FOLDERS_OVERRIDES
        else env
    )

    return bucket.blob("{}/{}".format(folder, file_name))


def _get_private_datasets_map_file(bucket: storage.Bucket = None) -> storage.Blob:
    """
    This pulls from a file hosted on the bucket
    The format looks as follows
        the dataset_id column has changed to uuids, but the old entries are still there and it's just an opaque string

    dataset_id,dataset,display_name,units,feature_name,owner_id
    private-b4d7094196889fa4614409570bb12ab5c09c9cc00388deb7c13ec57fd2996461,sample_data/dataset/canary.csv,Canary dataset local,chirps,canary w____,2
    private-5f721cbb537eef0a4e7fab55c4e1c7c41bdbb6ab7f547c9a43cb274cd4cf425a,gs://dmc-uploads/canary.csv,Canary dataset bucket,chirps,canary w____,2
    """
    if bucket is None:
        bucket = _get_private_datasets_bucket()
    return _get_private_datasets_file(PRIVATE_DATASETS_MAP_FILE, bucket)


###### below are the only methods that should be called outside of this module


def write_user_upload_file(file_name: str, content_fd: typing.IO, content_type: str):
    bucket = _get_private_datasets_bucket()
    blob = _get_private_datasets_file(file_name, bucket)
    blob.upload_from_file(content_fd, content_type=content_type)
    return "gs://{}/{}".format(
        PRIVATE_DATASETS_BUCKETS_BY_ENV[current_app.config["ENV"]], blob.name
    )


@typechecked
def update_user_upload_records(records: List[UserUploadRecord]):
    bucket = _get_private_datasets_bucket()
    blob = _get_private_datasets_map_file(bucket)
    df = pd.DataFrame([dataclasses.asdict(x) for x in records])
    blob.upload_from_string(df.to_csv(index=False), content_type="text/csv")


@typechecked
def get_user_upload_records() -> List[UserUploadRecord]:
    """
    Optional whether to pass in private_datasets_map_file. If not passed in function will just get it
    Calls to this function might choose to pass private_datasets_map_file in as map_blob if, for instance,
        it wants to retrieve the private_datasets_map_file object outside and use it elsewhere
    """
    map_blob = _get_private_datasets_map_file()
    if map_blob.exists():
        content = io.BytesIO(map_blob.download_as_string())
        row_dicts = [
            _apply_property_overrides(row)
            for row in pd.read_csv(content).to_dict("record")
        ]
        df = [UserUploadRecord(**row) for row in row_dicts]
    else:
        df = []

    return df


@typechecked
def delete_private_datasets(
    dataset_ids: List[str], client: Optional[storage.Client] = None
) -> List[str]:
    if client is None:
        client = _get_private_datasets_client()

    deleted_datasets = []

    bucket = _get_private_datasets_bucket(client=client)
    for dataset_id in dataset_ids:
        dataset_metadata = PrivateDatasetMetadata.get_by_dataset_id(dataset_id)

        blob = storage.Blob.from_string(dataset_metadata.csv_path, client=client)
        if blob.bucket.name == bucket.name and blob.exists():
            # Only allow deletion of datasets stored in this bucket (i.e. uploaded
            # through the UI, and not by us manually)
            blob.delete()
            print(f"Deleting from cloud storage: {dataset_metadata.csv_path}")

        print(f"Deleting private dataset from database: {dataset_id}")
        # Data access details should be in interactive config
        dataset = NonstandardMatrix.get(dataset_id)
        dataset.delete()
        dataset_metadata.delete()
        deleted_datasets.append(dataset_id)

    db.session.commit()
    return deleted_datasets


# this is a **temporary** set of hacks being applied until we can migrate these datasets to
# breadbox. Since the plan is that these will eventually live in breadbox, I'm using this
# quick and dirty approach of overriding values that are read from the CSV in cloud storage as the
# way to add properties and/or change the ID being used.
USER_UPLOAD_DATA_PROPERTIES_OVERRIDES: List[Tuple[List[str], Dict]] = [
    (
        [
            "ac1da2c0-3b09-4c70-b005-f40426d922f2",
            "d2975dcd-976e-44cd-a5b6-5da0056540af",
        ],
        {
            "dataset_id": "ac1da2c0-3b09-4c70-b005-f40426d922f2",
            "data_type": DataTypeEnum.methylation.name,
        },
    ),
    (
        [
            "e8ac41b9-d64b-4d96-9adf-4dccbed568b3",
            "3047c59d-50a8-412c-9051-036a9959094d",
        ],
        {
            "dataset_id": "e8ac41b9-d64b-4d96-9adf-4dccbed568b3",
            "data_type": DataTypeEnum.methylation.name,
            "priority": 1,
        },
    ),
    (
        [
            "2a8d18d2-0707-4b4c-9ceb-279d5592703a",
            "2f09749c-822e-4dbf-808f-dfb2c2cfdc84",
        ],
        {
            "dataset_id": "2a8d18d2-0707-4b4c-9ceb-279d5592703a",
            "data_type": DataTypeEnum.methylation.name,
        },
    ),
    (
        [
            "f325e2b0-3e1b-47cd-b1fb-66e8c8919638",
            "300ca8de-a828-4f5f-a47c-c1960f8a770b",
        ],
        {
            "dataset_id": "f325e2b0-3e1b-47cd-b1fb-66e8c8919638",
            "data_type": DataTypeEnum.methylation.name,
        },
    ),
]


def _apply_property_overrides(row_dict: dict):
    for dataset_ids, overrides in USER_UPLOAD_DATA_PROPERTIES_OVERRIDES:
        if row_dict["dataset_id"] in dataset_ids:
            new_dict = dict(row_dict)
            new_dict.update(overrides)
            log.warning("Override applied: %s -> %s", row_dict, new_dict)
            return new_dict
    return row_dict
