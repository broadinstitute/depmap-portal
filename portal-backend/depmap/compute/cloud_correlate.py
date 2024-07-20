from requests_toolbelt.multipart import decoder

import requests
import numpy as np
from concurrent.futures import ThreadPoolExecutor
import re

# import aiohttp
# import asyncio
import typing
import pandas as pd
import json
import struct
from google.oauth2 import service_account
from google.cloud import storage


flatten = lambda t: [item for sublist in t for item in sublist]
import io

from uuid import uuid4

import time

start = time.time()


def p(msg):
    print(f"{time.time()-start}: {msg}\n")


def _serialize_float32_vector(v):
    return v.astype("<f").tobytes()


def _serialize_float32_matrix(m):
    return m.astype("<f").tobytes(order="F")


def _parse_float32_vector(b):
    return np.frombuffer(b, "<f")


def _parse_int_vector(b):
    return np.frombuffer(b, "<u4")


def _extract_name_from_content_disposition(field_str):
    fields = [x.strip() for x in field_str.split(";")]
    for field in fields:
        m = re.match('^name="([^"]+)"$', field)
        if m is not None:
            return m.group(1)
    return None


def _parse_submission_response(response):
    multipart_data = decoder.MultipartDecoder.from_response(response)

    correlation_vector = None
    count_vector = None
    labels = None
    vector_ids = None
    for part in multipart_data.parts:
        # print("part", part.headers.keys())
        name = _extract_name_from_content_disposition(
            part.headers[b"Content-Disposition"].decode("utf8")
        )
        if name == "correlation_vector":
            correlation_vector = _parse_float32_vector(part.content)
        elif name == "count_vector":
            count_vector = _parse_int_vector(part.content)
        elif name == "vectorIds":
            vector_ids = json.loads(part.content)
        elif name == "labels":
            labels = json.loads(part.content)
        # print(part.content)  # Alternatively, part.text if you want unicode
        else:
            print("ignoring:", part.headers)
    assert correlation_vector is not None, "Response missing correlation_vector"
    assert count_vector is not None, "Response missing count_vector"
    return correlation_vector, count_vector, vector_ids, labels


def _single_submission(request):
    "Give a vector and a matrix, serialize them and send them to the cloud function for computation"
    submission_url, vector, row_indices, matrix_url = request
    response = requests.post(
        submission_url,
        headers=dict(Accept="multipart/form-data"),
        data=dict(vector_length=str(len(vector)), matrix_url=matrix_url),
        files=dict(
            vector=_serialize_float32_vector(vector),
            row_indices=_parse_int_vector(row_indices),
        ),
    )

    assert (
        response.status_code == 200
    ), f"Correlation calc submission failed. Got status_code={response.status_code}, response body: {response.text}"
    #    print(response.text)
    correlation_vector, count_vector, vectorIds, labels = _parse_submission_response(
        response
    )
    return correlation_vector, count_vector, labels, vectorIds


def _partition_matrix(column_annotations, matrix, columns_within_limit):
    # we should have a row in column_annotations for each column in our matrix
    assert column_annotations.shape[0] == matrix.shape[1]

    rows = matrix.shape[0]
    columns = matrix.shape[1]
    result = []
    for i in range(0, columns, columns_within_limit):
        columns_part = column_annotations.iloc[i : i + columns_within_limit, :]
        matrix_part = matrix[:, i : i + columns_within_limit]
        result.append((columns_part, matrix_part))
    return result


# asdjfaisdjfaisdjfasdijfasdlkfamlac
# adsfladmfadmf Hi Amelia
#


def test_partition_matrix():
    df = pd.DataFrame({"a": [1, 2, 3], "b": [5, 6, 7]})
    matrix = np.zeros((2, 3))
    parts = _partition_matrix(df, matrix, 2)

    assert len(parts) == 2
    df_part, matrix_part = parts[0]
    assert df_part.shape[0] == 2
    assert matrix_part.shape == (2, 2)

    df_part, matrix_part = parts[1]
    assert df_part.shape[0] == 1
    assert matrix_part.shape == (2, 1)


def _serialize_matrix_blob(columns, matrix):
    # const MagicValue = 0xb10bface

    # type MatrixBlob struct {
    # 	rowCount, columnCount uint32
    # 	fields                map[string]string
    # 	matrix                [][]float32
    # }

    # // format is: (all values are little edian)
    # // (4 bytes) magic value "bl0bface"
    # // (4 bytes) row count
    # // (4 bytes) column count
    # // (4 bytes) number of string fields
    # // next fields repeat, one per string fields
    # // (4 bytes) fieldName length
    # // (fieldName length bytes) field name
    # // (4 bytes) fieldValue length
    # // (fieldValue length bytes) field value
    # // (row count * column count * 4 bytes) matrix stored as float32s
    row_count, column_count = matrix.shape

    fields = []
    for column in columns.columns:
        fields.append((column, json.dumps(list(columns[column]))))

    magic_value = 0xB10BFACE
    w = io.BytesIO()
    w.write(struct.pack("<IIII", magic_value, row_count, column_count, len(fields)))

    def write_var_str(s):
        sb = s.encode("utf8")
        w.write(struct.pack("<I", len(sb)))
        w.write(sb)

    for name, value in fields:
        write_var_str(name)
        write_var_str(value)
    w.write(_serialize_float32_matrix(matrix))

    return w.getvalue()


def _split_gcs_path(path):
    m = re.match("gs://([^/]+)/(.*)", path)
    bucket_name = m.group(1)
    key = m.group(2)
    return bucket_name, key


class CloudPearsonCorClient:
    def __init__(
        self,
        storage_client,
        url,
        gcs_staging_folder,
        workers,
        max_matrix_size=8 * 1024 * 1024,
    ):
        """URL is the endpoint to submit the data to. max_submission is the max size of each submission. workers is the number of threads to spawn when submitting the requests"""
        self.url = url
        self.storage_client = storage_client
        self.max_matrix_size = max_matrix_size
        self.workers = workers
        self.gcs_staging_folder = gcs_staging_folder

    def read_obj_json(self, path):
        bucket_name, key = _split_gcs_path(path)
        bucket = storage.Bucket(self.storage_client, bucket_name)
        blob = bucket.get_blob(key)
        if blob is None:
            return None
        return json.loads(blob.download_as_string())

    def _store_obj_bytes(self, path, value):
        bucket_name, key = _split_gcs_path(path)
        bucket = storage.Bucket(self.storage_client, bucket_name)
        blob = storage.Blob(key, bucket)
        blob.upload_from_file(io.BytesIO(value))

    def upload_columns(self, path, columns, matrix):
        matrix_blob = _serialize_matrix_blob(columns, matrix)
        print(f"uploading {len(matrix_blob)} bytes to {path}")
        self._store_obj_bytes(path, matrix_blob)

    def stage_matrix(self, prefix, column_annotations, matrix):
        # divide the matrix up into chunks, where each chunk is smaller than max_submission
        assert len(column_annotations) == matrix.shape[1]
        rows = matrix.shape[0]
        columns_within_limit = self.max_matrix_size // (rows * 4)

        matrix_parts = _partition_matrix(
            column_annotations, matrix, columns_within_limit
        )
        part_paths = []
        for i, matrix_part in enumerate(matrix_parts):
            columns_subset, matrix_subset = matrix_part
            path = f"{prefix}/{i}"
            self.upload_columns(path, columns_subset, matrix_subset)
            part_paths.append(path)

        self._store_obj_bytes(f"{prefix}-parts", json.dumps(part_paths).encode("utf8"))
        return part_paths

    def submit(
        self,
        vector,
        matrix_rows,
        matrix_uuid: str,
        get_matrix_callback: typing.Callable[
            [], typing.Tuple[pd.DataFrame, np.ndarray]
        ],
    ):

        assert len(vector.shape) == 1
        assert len(matrix_rows.shape) == 1
        assert vector.shape[0] == matrix_rows.shape[0]

        max_matrix_row_index = max(*matrix_rows)
        print(f"max_matrix_row_index {max_matrix_row_index}")

        # first, have we staged the data in GCS yet?
        import hashlib

        cached_uuid = (
            hashlib.sha256(f"{matrix_uuid}:{self.max_matrix_size}:v3".encode("utf8"))
            .digest()
            .hex()
        )
        prefix = f"{self.gcs_staging_folder}/{cached_uuid}"
        parts_file_path = f"{prefix}-parts"
        print(f"Checking for {parts_file_path}")
        part_paths = self.read_obj_json(parts_file_path)
        if part_paths is None:
            # this doesn't already exist in the staging folder, so create it
            column_annotations, matrix = get_matrix_callback()
            print("staging...")
            print(
                f"submitting correlation of element {vector.shape[0]} vector and {matrix.shape} matrix with {column_annotations.shape} column annotations"
            )
            part_paths = self.stage_matrix(prefix, column_annotations, matrix)
        import datetime

        def get_url(path):
            bucket_name, key = _split_gcs_path(path)
            bucket = self.storage_client.bucket(bucket_name)
            blob = bucket.blob(key)

            url = blob.generate_signed_url(
                version="v4",
                # This URL is valid for 15 minutes
                expiration=datetime.timedelta(days=1),
                # Allow GET requests using this URL.
                method="GET",
            )
            return url

        vector = vector.astype("<f")
        requests = [
            (self.url, vector, matrix_rows, get_url(part_path))
            for part_path in part_paths
        ]

        print(f"submitting {len(requests)} requests via {self.workers} workers")
        # submit parts in parallel
        submissions_by_id = {}
        with ThreadPoolExecutor(max_workers=self.workers) as executor:
            for i, request in enumerate(requests):
                f = executor.submit(
                    lambda request: (i, _single_submission(request)), request
                )
                submissions_by_id[i] = f

        import concurrent.futures

        responses = []
        first_response_time = None
        timeout = 20
        submissions = list(submissions_by_id.values())
        while len(submissions) > 0:
            done, not_done = concurrent.futures.wait(
                submissions,
                timeout=timeout,
                return_when=concurrent.futures.FIRST_COMPLETED,
            )
            if len(done) == 0:
                raise Exception("Timeout waiting for results")
            for f in done:
                i, response = f.result()
                responses.append(response)
                del submissions_by_id[i]
            submissions = list(not_done)
            if first_response_time is None:
                first_response_time = time.time()
                timeout = 3

        # assemble outputs
        (
            correlation_vector_parts,
            count_vector_parts,
            labels_parts,
            vector_ids_parts,
        ) = zip(*responses)

        correlation_vector = np.concatenate(correlation_vector_parts)
        count_vector = np.concatenate(count_vector_parts)
        labels = flatten(labels_parts)
        vector_ids = flatten(vector_ids_parts)

        return correlation_vector, count_vector, labels, vector_ids


def generate_sample():
    matrix = np.array([[0, 1], [2, 3], [4, 5]])
    rows, columns = matrix.shape
    vector = matrix[:, 0]
    columns = pd.DataFrame(
        {
            "labels": [f"l{i}" for i in range(rows)],
            "vectorIds": [f"v{i}" for i in range(rows)],
        }
    )
    with open("sample-matrix-blob", "wb") as fd:
        fd.write(_serialize_matrix_blob(columns, matrix))


# todo: write go test to verify we can parse this blob
# todo: update go test to use new query parameters
# todo: change submit to return a dataframe
def test_submit():
    matrix = np.random.uniform(size=(1000, 20000))
    rows, columns = matrix.shape
    vector = matrix[:, 0]
    column_annotations = pd.DataFrame(
        {
            "labels": [f"l{i}" for i in range(columns)],
            "vectorIds": [f"v{i}" for i in range(columns)],
        }
    )

    # id1 = uuid4()
    # id2 = uuid4()
    id1 = "dbid"

    key_path = "/Users/pmontgom/.sparkles-cache/service-keys/broad-achilles.json"
    credentials = service_account.Credentials.from_service_account_file(
        key_path, scopes=storage.Client.SCOPE,
    )
    client = storage.Client(credentials=credentials, project="broad-achilles",)

    url = "http://us-central1-broad-achilles.cloudfunctions.net/ComputePearsonV2"
    client = CloudPearsonCorClient(
        client,
        url,
        "gs://broad-achilles-kubeque/test/cloud-pearson",
        30,
        max_matrix_size=8 * 1024 * 1024,
    )

    p("run1")
    # first run uploads
    correlation_vector, count_vector, labels, vector_ids = client.submit(
        vector, np.arange(len(vector)), id1, lambda: (column_annotations, matrix),
    )
    assert len(correlation_vector) == columns
    assert len(count_vector) == columns
    assert len(labels) == columns
    assert len(vector_ids) == columns
    # GIVE ME BANANAS!!!!!!!!!!!!!
    # second run just re-runs
    p("run2")
    correlation_vector, count_vector, labels, vector_ids = client.submit(
        vector, np.arange(len(vector)), id1, lambda: (columns, matrix)
    )
    p("complete")


if __name__ == "__main__":
    test_submit()
# test_partition_matrix()
