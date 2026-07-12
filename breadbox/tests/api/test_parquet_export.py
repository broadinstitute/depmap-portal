import pandas as pd
from pandas.testing import assert_frame_equal

from breadbox.schemas.dataset import AnnotationType, ColumnMetadata
from breadbox.service.gcs import get_signed_key_generator, get_tempspace
from breadbox.service.tempspace import FileObjStore, Tempspace

from .. import factories


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
