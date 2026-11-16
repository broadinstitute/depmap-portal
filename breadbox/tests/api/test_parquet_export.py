import pandas as pd
from pandas.testing import assert_frame_equal

from breadbox.schemas.dataset import AnnotationType, ColumnMetadata
from breadbox.service.gcs import get_signed_key_generator, get_tempspace
from breadbox.service.tempspace import FileObjStore, Tempspace

from .. import factories
from ..utils import assert_task_success
from .test_flat_tables import _upload_flat_table


def _fake_export_dependencies(client, tmpdir):
    """
    Overrides the GCS-backed tempspace/signed-url dependencies with a
    FileObjStore-backed Tempspace and a fake signer, and returns a dict that
    records url -> gcs_path for every signed url produced by the fake signer.
    """
    tempspace = Tempspace(FileObjStore(str(tmpdir.join("storage"))), interval=3600)
    generated_urls = {}

    def fake_signed_url_generator(gcs_path: str, expiration_minutes: int) -> str:
        url = (
            f"https://signed.example/{gcs_path}?expiration_minutes={expiration_minutes}"
        )
        generated_urls[url] = gcs_path
        return url

    client.app.dependency_overrides[get_tempspace] = lambda: tempspace
    client.app.dependency_overrides[
        get_signed_key_generator
    ] = lambda: fake_signed_url_generator

    return generated_urls


def test_export_tabular(client, minimal_db, settings, tmpdir):
    data_df = pd.DataFrame({"label": ["X", "Y"], "depmap_id": ["ACH-1", "ACH-2"]})
    columns_metadata = {
        "label": ColumnMetadata(col_type=AnnotationType.text),
        "depmap_id": ColumnMetadata(col_type=AnnotationType.text),
    }
    dataset = factories.tabular_dataset(
        minimal_db, settings, data_df=data_df, columns_metadata=columns_metadata
    )

    generated_urls = _fake_export_dependencies(client, tmpdir)

    admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}
    response = client.post(
        "/temp/parquet-export/tabular",
        json={"dataset_id": dataset.id, "destination": "ignored"},
        headers=admin_headers,
    )

    assert response.status_code == 200, response.content
    url = response.json()["url"]

    assert url in generated_urls
    gcs_path = generated_urls[url]

    exported_df = pd.read_parquet(gcs_path)
    assert_frame_equal(
        exported_df.reset_index(drop=True)[data_df.columns],
        data_df.reset_index(drop=True),
        check_names=False,
        check_dtype=False,
    )


def test_export_matrix(client, minimal_db, settings, tmpdir):
    dataset = factories.matrix_dataset(
        minimal_db,
        settings,
        data_file=factories.continuous_matrix_csv_file(
            feature_ids=["A", "B", "C"], sample_ids=["ACH-1", "ACH-2"]
        ),
    )

    generated_urls = _fake_export_dependencies(client, tmpdir)

    admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}
    response = client.post(
        "/temp/parquet-export/matrix",
        json={
            "dataset_id": dataset.id,
            "destination": "ignored",
            "feature_ids": ["A", "B"],
            "sample_ids": None,
        },
        headers=admin_headers,
    )

    assert response.status_code == 200, response.content
    url = response.json()["url"]

    assert url in generated_urls
    gcs_path = generated_urls[url]

    exported_df = pd.read_parquet(gcs_path)
    expected_df = pd.DataFrame(
        {
            "sample_id": ["ACH-1", "ACH-1", "ACH-2", "ACH-2"],
            "feature_id": ["A", "B", "A", "B"],
            "value": [0.0, 1.0, 3.0, 4.0],
        }
    )

    sort_cols = ["sample_id", "feature_id"]
    assert_frame_equal(
        exported_df.sort_values(sort_cols).reset_index(drop=True),
        expected_df.sort_values(sort_cols).reset_index(drop=True),
        check_dtype=False,
    )


def test_export_flattable(client, db, settings, tmpdir, mock_celery_flat_table):
    admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}

    upload_response = _upload_flat_table(
        client, tmpdir, given_id="export_table", headers=admin_headers,
    )
    assert_task_success(upload_response)
    flat_table_id = upload_response.json()["result"]["flat_table_id"]

    generated_urls = _fake_export_dependencies(client, tmpdir)

    response = client.post(
        "/temp/parquet-export/flattable",
        json={"flat_table_id": flat_table_id, "columns": ["id", "amount"]},
        headers=admin_headers,
    )

    assert response.status_code == 200, response.content
    url = response.json()["url"]

    assert url in generated_urls
    gcs_path = generated_urls[url]

    exported_df = pd.read_parquet(gcs_path)
    expected_df = pd.DataFrame(
        {"id": ["r1", "r2", "r3", "r4"], "amount": [10, 20, 30, 40]}
    )
    assert_frame_equal(
        exported_df.reset_index(drop=True),
        expected_df.reset_index(drop=True),
        check_dtype=False,
    )


# --- local (no-GCS) mode and GCS mode, exercised through the real dependencies ---


def _matrix_request(dataset):
    return {
        "dataset_id": dataset.id,
        "feature_ids": ["A", "B"],
        "sample_ids": None,
    }


def _make_matrix(minimal_db, settings):
    return factories.matrix_dataset(
        minimal_db,
        settings,
        data_file=factories.continuous_matrix_csv_file(
            feature_ids=["A", "B", "C"], sample_ids=["ACH-1", "ACH-2"]
        ),
    )


def test_export_matrix_local_mode_without_gcs(client, minimal_db, settings, tmpdir):
    import os

    settings.gcs_credentials_path = None
    settings.breadbox_env = "dev"
    settings.local_export_dir = str(tmpdir.join("local_exports"))
    dataset = _make_matrix(minimal_db, settings)

    response = client.post(
        "/temp/parquet-export/matrix",
        json=_matrix_request(dataset),
        headers={"X-Forwarded-Email": settings.admin_users[0]},
    )

    assert response.status_code == 200, response.content
    url = response.json()["url"]
    # a plain absolute, symlink-free path inside the export dir
    assert os.path.isabs(url) and "://" not in url
    assert url == os.path.realpath(url)
    assert url.startswith(os.path.realpath(settings.local_export_dir) + os.sep)

    exported_df = pd.read_parquet(url)
    expected_df = pd.DataFrame(
        {
            "sample_id": ["ACH-1", "ACH-1", "ACH-2", "ACH-2"],
            "feature_id": ["A", "B", "A", "B"],
            "value": [0.0, 1.0, 3.0, 4.0],
        }
    )
    sort_cols = ["sample_id", "feature_id"]
    assert_frame_equal(
        exported_df.sort_values(sort_cols).reset_index(drop=True),
        expected_df,
        check_dtype=False,
    )


def test_export_tabular_local_mode_without_gcs(client, minimal_db, settings, tmpdir):
    settings.gcs_credentials_path = None
    settings.breadbox_env = "dev"
    settings.local_export_dir = str(tmpdir.join("local_exports"))
    data_df = pd.DataFrame({"label": ["X", "Y"], "depmap_id": ["ACH-1", "ACH-2"]})
    dataset = factories.tabular_dataset(
        minimal_db,
        settings,
        data_df=data_df,
        columns_metadata={
            "label": ColumnMetadata(col_type=AnnotationType.text),
            "depmap_id": ColumnMetadata(col_type=AnnotationType.text),
        },
    )

    response = client.post(
        "/temp/parquet-export/tabular",
        json={"dataset_id": dataset.id},
        headers={"X-Forwarded-Email": settings.admin_users[0]},
    )

    assert response.status_code == 200, response.content
    exported_df = pd.read_parquet(response.json()["url"])
    assert_frame_equal(
        exported_df.reset_index(drop=True)[data_df.columns],
        data_df,
        check_names=False,
        check_dtype=False,
    )


def test_export_without_gcs_outside_dev_fails_clearly(
    client, minimal_db, settings, tmpdir
):
    settings.gcs_credentials_path = None
    settings.breadbox_env = "prod"
    settings.local_export_dir = str(tmpdir.join("local_exports"))
    dataset = _make_matrix(minimal_db, settings)

    response = client.post(
        "/temp/parquet-export/matrix",
        json=_matrix_request(dataset),
        headers={"X-Forwarded-Email": settings.admin_users[0]},
    )

    assert response.status_code == 503
    assert "GCS_CREDENTIALS_PATH" in response.json()["detail"]
    # and nothing was written locally
    assert not tmpdir.join("local_exports").check()


def test_export_matrix_with_gcs_configured_still_signs_urls(
    client, minimal_db, settings, tmpdir, monkeypatch
):
    """With credentials set, the GCS client is built from them, the file goes through
    the GCS object store, and the returned url is the client's signed url."""
    from unittest.mock import MagicMock

    import breadbox.service.gcs as gcs_module

    settings.gcs_credentials_path = "/fake/creds.json"
    settings.gcs_temp_path = "gs://test-bucket/tmp/"
    settings.breadbox_env = "dev"  # GCS must win even in dev
    settings.local_export_dir = str(tmpdir.join("local_exports"))
    dataset = _make_matrix(minimal_db, settings)

    blob = MagicMock()
    blob.exists.return_value = False
    blob.generate_signed_url.return_value = "https://signed.example/the-url"
    client_mock = MagicMock()
    client_mock.bucket.return_value.blob.return_value = blob
    from_json = MagicMock(return_value=client_mock)
    monkeypatch.setattr(
        gcs_module.storage.Client, "from_service_account_json", from_json
    )

    response = client.post(
        "/temp/parquet-export/matrix",
        json=_matrix_request(dataset),
        headers={"X-Forwarded-Email": settings.admin_users[0]},
    )

    assert response.status_code == 200, response.content
    assert response.json()["url"] == "https://signed.example/the-url"
    from_json.assert_called_once_with("/fake/creds.json")
    client_mock.bucket.assert_called_with("test-bucket")
    blob.upload_from_filename.assert_called_once()
    blob.generate_signed_url.assert_called_once()
    assert blob.generate_signed_url.call_args.kwargs["method"] == "GET"
    assert not tmpdir.join("local_exports").check()
