import re
import os
import requests
import tempfile
from typeguard import typechecked
from flask import current_app
from oauth2client.service_account import ServiceAccountCredentials

from depmap.interactive.nonstandard.models import (
    NonstandardMatrix,
    CellLineNameType,
    PrivateDatasetMetadata,
)
from depmap.user_uploads.utils.bucket_utils import UserUploadRecord
from depmap.utilities.hdf5_utils import csv_to_hdf5
from depmap.utilities.sign_bucket_url import sign_url

# currently unused, but could imagine it being used for bucket stuff
def _get_url_for_gs_object(gs_url):
    m = re.match("gs://([^/]+)/(.*)", gs_url)
    bucket = m.group(1)
    key = m.group(2)
    credentials = ServiceAccountCredentials.from_json_keyfile_name(
        current_app.config["DOWNLOADS_KEY"]
    )
    return sign_url(credentials, bucket, key)


def _download_csv_to_hdf5(csv_path, dest_path):
    if os.path.exists(dest_path):
        os.unlink(dest_path)
    if csv_path.startswith("gs://"):
        bucket_download_url = _get_url_for_gs_object(csv_path)
        req = requests.get(bucket_download_url, allow_redirects=True)
        assert (
            200 <= req.status_code <= 299
        ), f"{bucket_download_url} failed to download: {req.text}"
        with tempfile.NamedTemporaryFile() as temp_csv:
            for chunk in req.iter_content(chunk_size=10000):
                temp_csv.write(chunk)
                temp_csv.flush()
            csv_to_hdf5(temp_csv.name, dest_path)
    else:
        if not os.path.exists(csv_path):
            print(f"{csv_path} does not exist. Trying LOADER_DATA_DIR")
            csv_path = os.path.join(current_app.config["LOADER_DATA_DIR"], csv_path)
        csv_to_hdf5(csv_path, dest_path)


@typechecked
def load_private_dataset_from_df_row(row: UserUploadRecord) -> None:
    hdf5_name = row.dataset_id + ".hdf5"
    _download_csv_to_hdf5(
        row.dataset,
        os.path.join(current_app.config["NONSTANDARD_DATA_DIR"], hdf5_name),
    )

    cell_line_name_type = CellLineNameType(row.cell_line_name_type)
    use_arxspan_id = cell_line_name_type == CellLineNameType.depmap_id

    NonstandardMatrix.read_file_and_add_dataset_index(
        row.dataset_id,
        dict(transpose=row.is_transpose, data_type=row.data_type),
        hdf5_name,
        None,
        use_arxspan_id,
        row.owner_id,
    )

    PrivateDatasetMetadata.add(
        uuid=row.dataset_id,
        display_name=row.display_name,
        units=row.units,
        feature_name=row.feature_name,
        is_transpose=row.is_transpose,
        cell_line_name_type=cell_line_name_type,
        csv_path=row.dataset,
        owner_id=row.owner_id,
        data_type=row.data_type,
        priority=row.priority,
    )
