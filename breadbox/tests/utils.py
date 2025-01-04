import hashlib


def assert_status_ok(response):
    assert response.status_code >= 200 and response.status_code < 300, response.content


def assert_status_not_ok(response):
    assert not (
        response.status_code >= 200 and response.status_code < 300
    ), response.content


def assert_task_failure(response, status_code=None):
    # make sure getting the task status was successful
    assert_status_ok(response)

    task_status = response.json()
    assert task_status["state"] == "FAILURE"

    if status_code is not None:
        assert task_status["result"]["status_code"] == status_code


def upload_and_get_file_ids(client, data=None, filename=None, chunk_count=1):
    "Upload a file as a single chunk and get the file ID and MD5 to provide for another request"
    file_ids = []

    if data is not None:
        if hasattr(data, "read"):
            data = data.read()
        assert isinstance(data, bytes)
    else:
        assert filename is not None
        with open(filename, "rb") as fd:
            data = fd.read()

    chunk_size = (len(data) + chunk_count - 1) // chunk_count
    chunks = [data[i : i + chunk_size] for i in range(0, len(data), chunk_size)]

    for chunk in chunks:
        response = client.post(
            "/uploads/file",
            files={"file": ("filename", chunk, "application/vnd.apache.parquet")},
        )
        assert response.status_code == 200
        file_ids.append(response.json()["file_id"])

    expected_md5 = hashlib.md5(data).hexdigest()
    assert len(file_ids) == chunk_count
    return file_ids, expected_md5
