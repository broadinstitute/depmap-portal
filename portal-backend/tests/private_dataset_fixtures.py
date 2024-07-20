from depmap.enums import DataTypeEnum
import pytest
import tempfile
import pandas as pd
from flask import current_app
from google.cloud import storage
from depmap.user_uploads.utils import UserUploadRecord

from depmap.interactive.nonstandard.models import (
    PrivateDatasetMetadata,
    CellLineNameType,
)
from tests.mock_gcs import (
    mock_gcs,
)  # this import is required, it is taken in as a param to another fixture, and that fixture instantiation requires mock_gcs in the namespace
from depmap.user_uploads.utils import PRIVATE_DATASETS_BUCKETS_BY_ENV
from depmap.user_uploads.utils.bucket_utils import update_user_upload_records
from depmap.utilities.hdf5_utils import csv_to_hdf5
from tests.utilities.override_fixture import overridable_fixture
from tests.utilities.access_control import get_canary_group_id

FAKE_PROJECT = "depmap-tests-fake-project"


@overridable_fixture
def private_datasets_map_df(request):
    """
    this mocks out the private datasets map file
    """
    # these metadata objects don't actually do anything, they are not added to the db
    # they just exist to help make the dataframe
    private_dataset_local = PrivateDatasetMetadata(
        uuid="dataset-id-local",
        csv_path="sample_data/dataset/canary.csv",
        display_name="Canary local",
        units="chirps",
        feature_name="canary w____",
        owner_id=get_canary_group_id(),
        data_type=DataTypeEnum.crispr.name,
    )

    private_dataset_cloud = PrivateDatasetMetadata(
        uuid="dataset-id-cloud",
        csv_path="gs://dmc-uploads/canary.csv",
        display_name="Canary local",
        units="chirps",
        feature_name="canary w____",
        owner_id=get_canary_group_id(),
        data_type=DataTypeEnum.user_upload.name,
    )

    df = pd.DataFrame(
        {
            "dataset_id": [
                private_dataset_local.dataset_id,
                private_dataset_cloud.dataset_id,
            ],
            "dataset": [private_dataset_local.csv_path, private_dataset_cloud.csv_path],
            "display_name": [
                private_dataset_local.display_name,
                private_dataset_cloud.display_name,
            ],
            "units": [private_dataset_local.units, private_dataset_cloud.units],
            "feature_name": [
                private_dataset_local.feature_name,
                private_dataset_cloud.feature_name,
            ],
            "owner_id": [
                private_dataset_local.owner_id,
                private_dataset_cloud.owner_id,
            ],
            "data_type": [
                private_dataset_local.data_type,
                private_dataset_cloud.data_type,
            ],
            "is_transpose": [True, True],
            "cell_line_name_type": [
                CellLineNameType.depmap_id.name,
                CellLineNameType.depmap_id.name,
            ],
        }
    )
    return df


@pytest.fixture(scope="function")
def populated_gcs(monkeypatch, mock_gcs, private_datasets_map_df):
    client = storage.Client(project=FAKE_PROJECT)
    client.create_bucket(PRIVATE_DATASETS_BUCKETS_BY_ENV[current_app.config["ENV"]])

    def mock_client_from_service_account_json(service_account_json):
        return client

    monkeypatch.setattr(
        storage.Client,
        "from_service_account_json",
        mock_client_from_service_account_json,
    )

    class MockExistingClient(storage.Client):
        def __init__(self, project):
            super().__init__(project)
            if project == FAKE_PROJECT:
                self._buckets = client._buckets

    monkeypatch.setattr(storage, "Client", MockExistingClient)

    # 'Upload' canary csv
    dmc_uploads_bucket = client.create_bucket("dmc-uploads")
    private_dataset_blob = dmc_uploads_bucket.blob("canary.csv")
    private_dataset_blob.upload_from_string(
        open("sample_data/dataset/canary.csv").read()
    )

    records = [UserUploadRecord(**x) for x in private_datasets_map_df.to_dict("record")]

    update_user_upload_records(records)


@pytest.fixture(scope="function")
def upload_private_dataset_setup(populated_gcs, monkeypatch):
    # Get content from existing client
    from loader import nonstandard_private_loader

    client = storage.Client(project=FAKE_PROJECT)

    def mock_download_csv_to_hdf5(csv_path: str, dest_path: str):
        if csv_path.startswith("gs://"):
            blob = storage.Blob.from_string(csv_path, client)
            with tempfile.NamedTemporaryFile() as temp_csv:
                temp_csv.write(blob.download_as_string())
                temp_csv.flush()
                csv_to_hdf5(temp_csv.name, dest_path)
        else:
            csv_to_hdf5(csv_path, dest_path)

    monkeypatch.setattr(
        nonstandard_private_loader, "_download_csv_to_hdf5", mock_download_csv_to_hdf5
    )
