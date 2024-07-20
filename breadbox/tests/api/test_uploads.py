from fastapi.testclient import TestClient
from breadbox.api.uploads import construct_file_from_ids, get_itsdangerous_serializer
from ..factories import continuous_matrix_csv_file


def test_upload_file_as_chunks(client: TestClient, settings):
    file = continuous_matrix_csv_file()
    file_ids = []
    chunk = file.readline()
    while chunk:
        response = client.post(
            "/uploads/file", files={"file": ("filename", chunk, "text/csv")},
        )
        assert response.status_code == 200
        file_ids.append(response.json()["file_id"])
        chunk = file.readline()

    assert len(file_ids) == 3
    expected_md5 = "820882fc8dc0df48728c74db24c64fa1"

    final_file = construct_file_from_ids(
        file_ids,
        expected_md5,
        get_itsdangerous_serializer(settings),
        settings.compute_results_location,
    )
    with open(final_file, "rb") as fd:
        assert fd.read() == file.getvalue()
