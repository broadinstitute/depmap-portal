"""
Tests for the FlatTable API (see docs/flat-table-proposal.md).

Per the proposal, these are biased toward a small number of broad, end-to-end scenario
tests rather than many narrow single-assertion tests. Focused unit tests are reserved for
genuine edge cases (validation rules, specific error paths).

NOTE on celery: `mock_celery_flat_table` (tests/conftest.py) monkeypatches
`run_flat_table_upload.delay` to call the underlying plain function directly (in-process,
synchronously), the same technique the existing `mock_celery` fixture uses for dataset
uploads. This means these tests do NOT exercise real celery task dispatch, (de)serialization
of task arguments/results through a real broker, or the real `GET /api/task/{id}` polling
loop against a backend task store -- only the request-handling and DB-transaction logic
inside the task body. Worth reviewing closely given that limitation.
"""
import os

import pandas as pd
from fastapi.testclient import TestClient

from breadbox.db.session import SessionWithUser

from ..utils import (
    assert_status_ok,
    assert_task_failure,
    assert_task_success,
    upload_and_get_file_ids,
)

ADMIN_HEADERS = {"X-Forwarded-Email": "test-admin-user"}
NON_ADMIN_HEADERS = {"X-Forwarded-Email": "someone@example.com"}

DEFAULT_COLUMNS = [
    {"given_id": "id", "name": "ID", "references": None, "type": "string"},
    {
        "given_id": "category",
        "name": "Category",
        "references": "some_dim_type",
        "type": "string",
    },
    {"given_id": "amount", "name": "Amount", "references": None, "type": "int"},
    {"given_id": "score", "name": "Score", "references": None, "type": "float"},
]


def _default_df():
    return pd.DataFrame(
        {
            "id": ["r1", "r2", "r3", "r4"],
            "category": ["A", "B", "A", "B"],
            "amount": [10, 20, 30, 40],
            "score": [1.5, 2.5, 3.5, 4.5],
        }
    )


def _upload_flat_table(
    client: TestClient,
    tmpdir,
    *,
    given_id,
    headers=ADMIN_HEADERS,
    name="Test Table",
    df=None,
    columns=None,
    indices=None,
    taiga_id=None,
    metadata=None,
    file_md5_override=None,
    filename_suffix="",
):
    if df is None:
        df = _default_df()
    if columns is None:
        columns = DEFAULT_COLUMNS
    if indices is None:
        indices = [["category"]]

    data_path = str(tmpdir.join(f"data{filename_suffix}.parquet"))
    df.to_parquet(data_path, index=False)
    file_ids, expected_md5 = upload_and_get_file_ids(client, filename=data_path)

    body = {
        "given_id": given_id,
        "name": name,
        "file_ids": file_ids,
        "file_md5": file_md5_override or expected_md5,
        "file_format": "parquet",
        "taiga_id": taiga_id,
        "metadata": metadata,
        "columns": columns,
        "indices": indices,
    }
    return client.post("/flattable", json=body, headers=headers)


class TestScenarios:
    def test_full_lifecycle(
        self,
        client: TestClient,
        db: SessionWithUser,
        settings,
        tmpdir,
        mock_celery_flat_table,
    ):
        response = _upload_flat_table(
            client,
            tmpdir,
            given_id="lifecycle_table",
            taiga_id="taiga-123.1",
            metadata={"source": "unit-test"},
        )
        assert_task_success(response)
        result = response.json()["result"]
        assert result["row_count"] == 4
        assert result["given_id"] == "lifecycle_table"
        flat_table_id = result["flat_table_id"]

        # fetch by uuid and by given_id both return the same record
        by_uuid = client.get(f"/flattable/{flat_table_id}", headers=ADMIN_HEADERS)
        assert_status_ok(by_uuid)
        by_given_id = client.get("/flattable/lifecycle_table", headers=ADMIN_HEADERS)
        assert_status_ok(by_given_id)
        assert by_uuid.json() == by_given_id.json()
        assert by_uuid.json()["columns"] == DEFAULT_COLUMNS

        # list omits "columns" to keep the payload small
        listing = client.get("/flattables", headers=ADMIN_HEADERS)
        assert_status_ok(listing)
        summaries = {t["flat_table_id"]: t for t in listing.json()}
        assert flat_table_id in summaries
        assert "columns" not in summaries[flat_table_id]

        # subset: multiple filters (AND), explicit column subset
        subset = client.post(
            "/flattable/subset",
            json={
                "flat_table_id": flat_table_id,
                "filters": [
                    {"column": "category", "values": ["A"]},
                    {"column": "amount", "values": ["10", "30"]},
                ],
                "columns": ["id", "amount"],
            },
            headers=ADMIN_HEADERS,
        )
        assert_status_ok(subset)
        subset_body = subset.json()
        assert subset_body["row_count"] == 2
        columns_by_id = {
            c["metadata"]["given_id"]: c["values"] for c in subset_body["columns"]
        }
        assert set(columns_by_id.keys()) == {"id", "amount"}
        assert sorted(columns_by_id["id"]) == ["r1", "r3"]
        assert sorted(columns_by_id["amount"]) == [10, 30]

        # subset: no `columns` given -> all columns returned, raw (unresolved) reference value
        full_subset = client.post(
            "/flattable/subset",
            json={"flat_table_id": flat_table_id, "filters": []},
            headers=ADMIN_HEADERS,
        )
        assert_status_ok(full_subset)
        full_columns = {
            c["metadata"]["given_id"]: c["values"]
            for c in full_subset.json()["columns"]
        }
        assert set(full_columns.keys()) == {"id", "category", "amount", "score"}
        assert sorted(full_columns["category"]) == ["A", "A", "B", "B"]

        # PATCH name
        patched = client.patch(
            f"/flattable/{flat_table_id}",
            json={"name": "Renamed table"},
            headers=ADMIN_HEADERS,
        )
        assert_status_ok(patched)
        assert patched.json()["name"] == "Renamed table"
        confirm = client.get(f"/flattable/{flat_table_id}", headers=ADMIN_HEADERS)
        assert confirm.json()["name"] == "Renamed table"

        # DELETE removes the row and the underlying sqlite file
        from breadbox.crud import flat_table as flat_table_crud

        db.reset_user(ADMIN_HEADERS["X-Forwarded-Email"])
        flat_table_row = flat_table_crud.get_flat_table(db, flat_table_id)
        assert flat_table_row is not None
        sqlite_full_path = os.path.join(
            settings.filestore_location, flat_table_row.sqlite_db_path
        )
        assert os.path.exists(sqlite_full_path)

        deleted = client.delete(f"/flattable/{flat_table_id}", headers=ADMIN_HEADERS)
        assert_status_ok(deleted)
        assert not os.path.exists(sqlite_full_path)

        after_delete = client.get(f"/flattable/{flat_table_id}", headers=ADMIN_HEADERS)
        assert after_delete.status_code == 404

    def test_given_id_versioning(
        self, client: TestClient, tmpdir, mock_celery_flat_table,
    ):
        first = _upload_flat_table(client, tmpdir, given_id="v1", filename_suffix="_v1")
        assert_task_success(first)
        first_id = first.json()["result"]["flat_table_id"]

        second_df = _default_df()
        second_df["amount"] = second_df["amount"] * 100
        second = _upload_flat_table(
            client, tmpdir, given_id="v1", df=second_df, filename_suffix="_v2",
        )
        assert_task_success(second)
        second_id = second.json()["result"]["flat_table_id"]
        assert second_id != first_id

        # old version is still reachable by its own uuid, with its original data intact
        old_by_uuid = client.get(f"/flattable/{first_id}", headers=ADMIN_HEADERS)
        assert_status_ok(old_by_uuid)
        assert old_by_uuid.json()["given_id"] is None

        # given_id now resolves to the new version
        current = client.get("/flattable/v1", headers=ADMIN_HEADERS)
        assert_status_ok(current)
        assert current.json()["flat_table_id"] == second_id

        # both versions are listed; only the current one has a given_id
        listing = client.get("/flattables", headers=ADMIN_HEADERS)
        summaries_by_id = {t["flat_table_id"]: t for t in listing.json()}
        assert summaries_by_id[second_id]["given_id"] == "v1"
        assert summaries_by_id[first_id]["given_id"] is None

        # subset against the given_id operates on the new data
        subset = client.post(
            "/flattable/subset",
            json={
                "flat_table_id": "v1",
                "filters": [{"column": "id", "values": ["r1"]}],
            },
            headers=ADMIN_HEADERS,
        )
        amount_values = next(
            c["values"]
            for c in subset.json()["columns"]
            if c["metadata"]["given_id"] == "amount"
        )
        assert amount_values == [1000]

        # PATCH can also supersede: reassign an unrelated table's given_id onto "v1"
        third = _upload_flat_table(client, tmpdir, given_id="v2", filename_suffix="_v3")
        assert_task_success(third)
        third_id = third.json()["result"]["flat_table_id"]

        client.patch(
            f"/flattable/{third_id}", json={"given_id": "v1"}, headers=ADMIN_HEADERS,
        )
        now_current = client.get("/flattable/v1", headers=ADMIN_HEADERS)
        assert now_current.json()["flat_table_id"] == third_id

        # deleting via the given_id only removes the current version
        client.delete("/flattable/v1", headers=ADMIN_HEADERS)
        still_there = client.get(f"/flattable/{second_id}", headers=ADMIN_HEADERS)
        assert_status_ok(still_there)

    def test_filtering_behavior(
        self, client: TestClient, tmpdir, mock_celery_flat_table,
    ):
        response = _upload_flat_table(
            client, tmpdir, given_id="filter_table", indices=[["category"]],
        )
        assert_task_success(response)
        flat_table_id = response.json()["result"]["flat_table_id"]

        def subset(filters):
            r = client.post(
                "/flattable/subset",
                json={
                    "flat_table_id": flat_table_id,
                    "filters": filters,
                    "columns": ["id"],
                },
                headers=ADMIN_HEADERS,
            )
            assert_status_ok(r)
            ids = next(c["values"] for c in r.json()["columns"])
            return sorted(ids), r.json()["row_count"]

        # filtering on the indexed column
        by_indexed, count_indexed = subset([{"column": "category", "values": ["A"]}])
        assert by_indexed == ["r1", "r3"]
        assert count_indexed == 2

        # filtering on a non-indexed column gives identical correctness
        by_non_indexed, count_non_indexed = subset(
            [{"column": "amount", "values": ["10"]}]
        )
        assert by_non_indexed == ["r1"]
        assert count_non_indexed == 1

        # combining indexed + non-indexed filters (AND)
        combo, combo_count = subset(
            [
                {"column": "category", "values": ["A"]},
                {"column": "amount", "values": ["30"]},
            ]
        )
        assert combo == ["r3"]
        assert combo_count == 1

        # no matches -> empty result, not an error
        empty, empty_count = subset([{"column": "category", "values": ["nonexistent"]}])
        assert empty == []
        assert empty_count == 0

    def test_access_control(
        self, client: TestClient, db: SessionWithUser, tmpdir, mock_celery_flat_table,
    ):
        # non-admins cannot create
        create_response = _upload_flat_table(
            client, tmpdir, given_id="access_table", headers=NON_ADMIN_HEADERS,
        )
        assert create_response.status_code == 403

        from breadbox.crud import flat_table as flat_table_crud

        db.reset_user(ADMIN_HEADERS["X-Forwarded-Email"])
        assert flat_table_crud.get_flat_tables(db) == []

        # create for real (as admin) so we have something to read/patch/delete
        created = _upload_flat_table(client, tmpdir, given_id="access_table")
        assert_task_success(created)
        flat_table_id = created.json()["result"]["flat_table_id"]

        # reads require no special permission
        assert_status_ok(
            client.get(f"/flattable/{flat_table_id}", headers=NON_ADMIN_HEADERS)
        )
        assert_status_ok(client.get("/flattables", headers=NON_ADMIN_HEADERS))
        assert_status_ok(
            client.post(
                "/flattable/subset",
                json={"flat_table_id": flat_table_id, "filters": []},
                headers=NON_ADMIN_HEADERS,
            )
        )

        # writes are blocked for non-admins, and don't change anything
        patch_response = client.patch(
            f"/flattable/{flat_table_id}",
            json={"name": "hijacked"},
            headers=NON_ADMIN_HEADERS,
        )
        assert patch_response.status_code == 403

        delete_response = client.delete(
            f"/flattable/{flat_table_id}", headers=NON_ADMIN_HEADERS,
        )
        assert delete_response.status_code == 403

        unchanged = client.get(f"/flattable/{flat_table_id}", headers=ADMIN_HEADERS)
        assert unchanged.json()["name"] == "Test Table"


class TestEdgeCases:
    def test_given_id_validation(
        self, client: TestClient, tmpdir, mock_celery_flat_table,
    ):
        response = _upload_flat_table(client, tmpdir, given_id="bad given/id")
        assert response.status_code == 422

    def test_patch_omitted_vs_explicit_null_given_id(
        self, client: TestClient, tmpdir, mock_celery_flat_table,
    ):
        response = _upload_flat_table(client, tmpdir, given_id="patch_null_table")
        assert_task_success(response)
        flat_table_id = response.json()["result"]["flat_table_id"]

        # omitting given_id entirely leaves it alone
        omitted = client.patch(
            f"/flattable/{flat_table_id}",
            json={"name": "renamed"},
            headers=ADMIN_HEADERS,
        )
        assert_status_ok(omitted)
        assert omitted.json()["given_id"] == "patch_null_table"
        assert omitted.json()["name"] == "renamed"

        # explicitly setting given_id to null clears it
        cleared = client.patch(
            f"/flattable/{flat_table_id}",
            json={"given_id": None},
            headers=ADMIN_HEADERS,
        )
        assert_status_ok(cleared)
        assert cleared.json()["given_id"] is None

        # it's no longer resolvable by the old given_id, only by its uuid
        by_given_id = client.get("/flattable/patch_null_table", headers=ADMIN_HEADERS)
        assert by_given_id.status_code == 404
        by_uuid = client.get(f"/flattable/{flat_table_id}", headers=ADMIN_HEADERS)
        assert_status_ok(by_uuid)
        assert by_uuid.json()["given_id"] is None

    def test_file_md5_mismatch(
        self, client: TestClient, tmpdir, mock_celery_flat_table,
    ):
        response = _upload_flat_table(
            client, tmpdir, given_id="md5_table", file_md5_override="0" * 32,
        )
        # NOTE: `format_task_status` always sets `result` to None on FAILURE (regardless of
        # what the task raised), so the failure reason can only be checked via `message`, not
        # `result["status_code"]` -- true for dataset upload failures too, not something new
        # to flat tables.
        assert_task_failure(response, message_contains="Expected md5 hash")

    def test_column_schema_mismatch(
        self, client: TestClient, tmpdir, mock_celery_flat_table,
    ):
        bad_columns = [
            {"given_id": "id", "name": "ID", "type": "string"},
            {"given_id": "category", "name": "Category", "type": "string"},
            # declared as string, but the uploaded column is actually an int
            {"given_id": "amount", "name": "Amount", "type": "string"},
            {"given_id": "score", "name": "Score", "type": "float"},
        ]
        response = _upload_flat_table(
            client, tmpdir, given_id="mismatch_table", columns=bad_columns,
        )
        assert_task_failure(response, message_contains="amount")

    def test_column_missing_from_file(
        self, client: TestClient, tmpdir, mock_celery_flat_table,
    ):
        columns_missing_one = [
            c for c in DEFAULT_COLUMNS if c["given_id"] != "score"
        ] + [{"given_id": "not_in_file", "name": "Nope", "type": "string"}]
        response = _upload_flat_table(
            client, tmpdir, given_id="missing_col_table", columns=columns_missing_one,
        )
        assert_task_failure(response, message_contains="not_in_file")

    def test_subset_unknown_flat_table_id(
        self, client: TestClient, mock_celery_flat_table,
    ):
        response = client.post(
            "/flattable/subset",
            json={"flat_table_id": "does-not-exist", "filters": []},
            headers=ADMIN_HEADERS,
        )
        assert response.status_code == 404

    def test_subset_unknown_filter_column(
        self, client: TestClient, tmpdir, mock_celery_flat_table,
    ):
        response = _upload_flat_table(client, tmpdir, given_id="unknown_col_table")
        assert_task_success(response)
        flat_table_id = response.json()["result"]["flat_table_id"]

        subset = client.post(
            "/flattable/subset",
            json={
                "flat_table_id": flat_table_id,
                "filters": [{"column": "not_a_real_column", "values": ["x"]}],
            },
            headers=ADMIN_HEADERS,
        )
        assert subset.status_code == 400
