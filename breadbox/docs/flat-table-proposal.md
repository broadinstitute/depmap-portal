# Overview

The goal of this API is to support use-cases in the portal where we need to upload a table and then need to retrieve a subset of this table for purposes of showing it to users. (Specifically, we do this for the Mutations and the Fusion tables that the Omics teams provide)

As a result, Breadbox does not need to have any business logic about the interpretation of the columns and will operate as a “dumb” store for this data.

These “FlatTables” are distinct from tabular datasets in a few ways:

1. They are not indexed by any Dimension Type
2. They are intentionally not accessible in Data Explorer and therefore, while similar in spirit to tabular datasets, they are distinct from tabular datasets.
3. The implementation must be built with the goal of supporting tables with up to roughly 100 million rows and \<1000 columns because the mutations table is quite large. (Exact size TBD — the actual mutations table row count hasn't been confirmed. Ingestion and querying must be designed to stream rather than load entire tables into memory, given this uncertainty.)

# Access control

FlatTables do not use the group-based access control model that datasets use (no `group_id`, no `PUBLIC_GROUP_ID`/`TRANSIENT_GROUP_ID`, no `user_has_access_to_group` checks):

- **Read** endpoints (GET /flattable/\<ID\>, GET /flattables, POST /flattable/subset) are available to any authenticated breadbox user.
- **Write** endpoints (POST /flattable, PATCH /flattable/\<ID\>, DELETE /flattable/\<ID\>) require the requesting user to be in `settings.admin_users`. Non-admins get 403.

# Endpoints

All parameters in the request body and in the response body are encoded as json.

## Create a flattable {#create-a-flattable}

POST /flattable

Used to upload and create a flattable. Admin-only (see [Access control](#access-control)).

Ingestion (parsing the uploaded parquet file and loading it into the per-table SQLite file, including building any requested indices) happens asynchronously via a Celery task, following the same pattern as the existing dataset upload flow (`compute/dataset_uploads_tasks.py::run_dataset_upload`). No FlatTable record is created up front — the task performs validation, ingestion, and the DB insert of the FlatTable row (including any given_id-supersede handled per [given_id semantics](#given_id-semantics)) all within one transaction, committed only on success. If ingestion fails, nothing is persisted; there is no "error" record left behind.

The endpoint itself returns `202` with a task-status body immediately (matching the existing `AddDatasetResponse` shape returned by dataset upload / consumed by `format_task_status`): `{state, id, message, result, percentComplete}`. The caller polls the existing generic `GET /api/task/{id}` endpoint (`api/apis.py::get_task_status`) using the returned `id` until `state` is `SUCCESS` or `FAILURE`. On `SUCCESS`, `result` contains the full created flat table's metadata — the same shape as the [Response](#create-a-flattable-response) below — so no separate GET is required (though [GET /flattable/\<ID\>](#fetch-flat-table-metadata) remains available for later lookups). On `FAILURE`, the failure message (e.g. column type mismatch, md5 mismatch) is derived the same way `_get_failure_message` does for dataset uploads.

### Request

| Property    | Type                | Description                                                                                                                                                                                                                                                                                                                                                  |
| :---------- | :------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| given_id    | str                 | required. A human readable unique key which we can hardcode to reference this table and which does not change identity across re-uploads. See [given_id semantics](#given_id-semantics) below for how this interacts with versioning. Must satisfy our given_id constraints to be url-safe ( ^\[A-Za-z0-9\_.-\]+$ )                                          |
| name        | str                 | Name of the table for display purposes                                                                                                                                                                                                                                                                                                                       |
| file_ids    | str\[\]             | a list of previously uploaded file chunks which should be used to reconstruct the uploaded file. (Identical to how dataset uploads work)                                                                                                                                                                                                                     |
| file_md5    | str                 | MD5 of the uploaded file to verify integrity after reconstruction                                                                                                                                                                                                                                                                                            |
| file_format | “parquet”           | In the initial implementation, this will be required to be “parquet” because that seems to be a good format for the files we’re uploading. However, from past experience with the uploading dataset api, I think it’s a good option to have a place to specify alternative formats in the future if necessary.                                               |
| taiga_id    | str (optional)      | The taiga ID that this table was sourced from                                                                                                                                                                                                                                                                                                                |
| metadata    | Map\[str\] \-\> Any | An arbitrary set of key value pairs attached to this instance which may be used by the breadbox loader or other situations where we don’t want to formally model a property in breadbox.                                                                                                                                                                     |
| columns     | ColumnMetadata\[\]  | The list of columns contained within the uploaded file. Validated against the parquet file's actual schema during ingestion — if a declared column is missing, or its declared `type` is incompatible with the actual parquet column type, the task fails (see above) with a message identifying the offending column(s). No implicit coercion is attempted. |
| indices     | str\[str\[\]\]      | A list of sets of columns which should have a SQLite index built on them, purely as a performance optimization for [subset queries](#fetch-data-from-a-flat-table). Filters may reference _any_ column regardless of whether it's covered by a declared index — unindexed filters just do a full-table scan and will be slower on a 100M-row table.          |

The ColumnMetadata type is described below

| Property   | Type           | Description                                                                                                                                                     |
| :--------- | :------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------ |
| given_id   | str            | how the column is named in the uploaded file                                                                                                                    |
| name       | str            | Name of the column for display purposes                                                                                                                         |
| references | Str (optional) | if set, indicates this column's values are IDs in the named Dimension type. See [subset response](#fetch-data-from-a-flat-table) for how this affects querying. |
| type       | “string” or ”int”  or   ”float” | What type to expect the values to be |

### Response {#create-a-flattable-response}

This is the shape embedded in the task's `result` field on success (see above), and is also what [GET /flattable/\<ID\>](#fetch-flat-table-metadata) returns.

| Property                                    | Type | Description                                                                                                                                                                                                                                                                                                                |
| :------------------------------------------ | :--- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| flat_table_id                               | str  | a UUID generated for the newly created table. Every create results in a new UUID and there’s no way to update the underlying data, so as long as the UUID doesn't change, the values are still the same. This UUID identifies this exact version forever, even after a newer version supersedes it for `given_id` lookups. |
| row_count                                   | int  | the number of rows (just for diagnostic purposes)                                                                                                                                                                                                                                                                          |
| given_id, name, taiga_id, metadata, columns |      | Same as in the values sent in on the original post request. They are returned here for consistency with the pattern where creation of a resource returns the final definition and is the same as the “get flat table” response.                                                                                            |

## Fetch flat table metadata {#fetch-flat-table-metadata}

GET /flattable/\<ID\>  
Retrieve metadata about a flat table. `<ID>` can be either the `flat_table_id` UUID or a `given_id`; resolution mirrors the existing `given_id`-or-id lookup used for datasets (`crud/dataset.py get_dataset`) — if `<ID>` matches a UUID it's used as-is, otherwise it's looked up by `given_id`, always resolving to the **current** version (see [given_id semantics](#given_id-semantics)).

### Response

Same format as the response for [Create a flattable](#create-a-flattable)

## List all flat tables

GET /flattables  
Retrieve a list of all flat tables, including superseded versions. A superseded version is distinguishable by having a null `given_id` (see [given_id semantics](#given_id-semantics)) -- it's still reachable individually via its own UUID.

### Response

Similar to the response from getting metadata for a single flat table, but since tables may have a large number of columns the "columns" field is omitted to keep the response size small.

## Update flat table metadata

PATCH /flattable/\<ID\>

Admin-only. Only allows for updating a few fields that are independent of the actual uploaded table. Once a table is uploaded, we don't allow updating the data itself, only deleting and replacing it (or uploading a new version — see [given_id semantics](#given_id-semantics)).

Unlike [create](#create-a-flattable), this is a simple metadata update with no file I/O, so it's handled synchronously in the request (no Celery task, no task-status polling) and returns the updated record directly.

`<ID>` resolves the same way as in [GET /flattable/\<ID\>](#fetch-flat-table-metadata).

Only fields actually present in the request body are updated -- a field that's omitted entirely is left untouched, while a field explicitly set to `null` is cleared. This matters for `given_id`: `PATCH` with `given_id` omitted leaves it alone, but `PATCH` with `"given_id": null` explicitly clears it (unpublishing this table -- it becomes reachable only by its UUID, with no other table superseding it).

### Request

| Property | type           | Description                                                                                                                                                                                                                                                                                                                                                                             |
| :------- | :------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| given_id | Str (optional) | Reassign this table's given*id. If another \_current* flat table already holds that given_id, that other table is superseded exactly as described in [given_id semantics](#given_id-semantics) — this table becomes the new current holder of the given_id, and the previous holder becomes reachable only by its own UUID. Must satisfy the given_id constraints: ^\[A-Za-z0-9\_.-\]+$ |
| name     | Str (optional) | Name of the table for display purposes                                                                                                                                                                                                                                                                                                                                                  |

### Response

Same format as the response for [Create a flattable](#create-a-flattable-response)

## Delete a flat table

DELETE /flattable/\<ID\>

Admin-only. Synchronous — deletes the DB row and its underlying SQLite data file directly (no Celery task). `<ID>` resolves the same way as in [GET /flattable/\<ID\>](#fetch-flat-table-metadata) (so deleting by given_id deletes the current version). This is permanent — there is no undo, and it does not restore a previously-superseded version to being "current".

### Response

empty with status 200 if successful

## Fetch data from a flat table {#fetch-data-from-a-flat-table}

POST /flattable/subset

Retrieve a subset of columns/rows based on filters on one or more columns (AND semantics — a row is returned only if it satisfies every filter).

The retrieved table is encoded as a list of columns. Returning values packed per column as opposed to per-row was chosen to reduce the amount of redundancy from having to list each column name per row and keep the payload smaller. Also, the columns are encoded as a list and not a map of column_name \-\> values so that the UI knows which order the columns should be displayed in.

### Request

| Property      | Type               | Description                                                                                                                 |
| :------------ | :----------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| flat_table_id | str                | either the given_id or the UUID; resolves to the current version if given_id, per [given_id semantics](#given_id-semantics) |
| filters       | Filter\[\]         | The filters which must ALL be satisfied by each returned row                                                                |
| columns       | str\[\] (optional) | The columns to return in the response. If omitted, all columns will be returned.                                            |

"Filter" definition

| Property | Type    | Description                                                      |
| :------- | :------ | :--------------------------------------------------------------- |
| column   | str     | The column to check                                              |
| values   | str\[\] | The row satisfies this filter if it has any of the values listed |

### Response

| Property  | Type       | Description                                                                                                                                         |
| :-------- | :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| columns   | Column\[\] | The retrieved values for the column along with their metadata. The order within this array determines the order they should be presented on the UI. |
| row_count | int        | number of rows satisfying the filters and returned                                                                                                  |

The "Column" type is defined as follows:

| Property | Type           | Description                                                                                                                                                                                |
| :------- | :------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| metadata | ColumnMetadata | The metadata from when the table was initially created                                                                                                                                     |
| values   | any\[\]        | The values for this column, exactly as uploaded. `references` is metadata only (e.g. for the frontend to build links) — breadbox does not resolve it to a label or otherwise interpret it. |

## given_id semantics (versioning) {#given_id-semantics}

Unlike dataset `given_id` (which is DB-unique and permanently claimed by one dataset), FlatTable `given_id` identifies the **current version** of a table, and re-using an existing given_id on a new upload is how you publish a new version:

- At the DB level, `given_id` remains a UNIQUE column (so given_id lookups are still a simple unique-key fetch, not an "ORDER BY created_at LIMIT 1").
- When [POST /flattable](#create-a-flattable) (or a [PATCH](#update-flat-table-metadata) reassignment) supplies a `given_id` that's already held by another FlatTable row, that existing row's `given_id` column is cleared/renamed aside as part of the same transaction, freeing it up for the new row to claim. The old row keeps its own UUID, its data, and its SQLite file untouched — it's simply no longer resolvable by given_id, only by its `flat_table_id` UUID.
- Old/superseded versions are kept indefinitely (not auto-deleted) until explicitly removed via [DELETE](#delete-a-flat-table).
- [GET /flattables](#list-all-flat-tables) lists every row, current and superseded alike; a superseded row is identifiable by its null given_id.

# Implementation notes

Internally, these tables will be implemented as database tables which contain the flattable metadata and column metadata, plus a separate per-table SQLite file (under `settings.filestore_location`, following the same precedent as `crud/predictive_models.py`'s parquet-to-sqlite conversion) holding the actual row data and any declared indices.

The internal relational database table "FlatTable" for this metadata:

| Property       | Type                   | Description                                                                                                                                                                              |
| :------------- | :--------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id             | str                    | randomly generated UUID                                                                                                                                                                  |
| given_id       | str (optional, unique) | A human readable unique key which we can hardcode to reference this table's current version. Null on superseded/old versions (see [given_id semantics](#given_id-semantics)).            |
| name           | str                    | Name of the table for display purposes                                                                                                                                                   |
| sqlite_db_path | str                    | Path to where the sqlite database exists that contains the actual data for this flattable.                                                                                               |
| taiga_id       | str (optional)         | The taiga ID that this table was sourced from                                                                                                                                            |
| metadata       | JSON                   | An arbitrary set of key value pairs attached to this instance which may be used by the breadbox loader or other situations where we don’t want to formally model a property in breadbox. |
| created_at     | datetime               | used for diagnostics/ordering; not used to resolve "current" version since that's tracked via the unique given_id column instead                                                         |

# Tests

Bias toward a small number of broad, scenario-style tests that drive the API end-to-end through `TestClient`, the way `TestPatch.test_update_dataset` and `TestDelete.test_delete` in `tests/api/test_datasets.py` do (create → act → verify via a second read → act again), rather than many narrow single-assertion tests. Reserve focused unit tests for genuine edge cases (validation rules, a specific error path). Use the `mock_celery` fixture (`tests/conftest.py`) so the create task runs synchronously in-process, and `upload_and_get_file_ids` / `assert_task_success` / `assert_task_failure` (`tests/utils.py`) for building uploads and checking task results, mirroring `tests/api/test_dataset_uploads.py`.

## Scenario tests (the bulk of the coverage)

1. **Full lifecycle, single table**: upload a small parquet flat table with a mix of string/int/float columns (including one `references` column) and at least one multi-column index → assert task `SUCCESS` and the returned metadata/row_count → `GET /flattable/<uuid>` and `GET /flattable/<given_id>` both return the same record → `GET /flattables` lists it (without `columns`) → `POST /flattable/subset` with multiple filters (AND across two columns) and an explicit `columns` subset returns the expected rows/values, including the raw (non-resolved) value for the `references` column → `POST /flattable/subset` with no `columns` returns all columns → PATCH `name` → GET confirms the update → DELETE → GET returns 404 and the underlying sqlite file is gone.
2. **given_id versioning**: create a flat table with given_id `g1` → create a second flat table reusing `g1` → assert the first table's row still exists and is fetchable by its own UUID but `GET /flattable/g1` now returns the second table's data → `GET /flattables` only lists the current (second) one → subset query against `g1` operates on the new data → delete via `g1` only removes the current version, the superseded one is untouched → repeat the same supersede check via PATCH (reassign given_id of an unrelated table onto `g1`) to confirm PATCH and create share the same supersede path.
3. **Filtering behavior**: one table with several indexed and several non-indexed columns → subset queries filtering on an indexed column, a non-indexed column, and a combination of both return identical/correct results (index is a perf hint only, not a correctness constraint) → a filter whose `values` match nothing returns `row_count: 0` and empty column arrays rather than an error.
4. **Access control**: as a non-admin user, POST/PATCH/DELETE all return 403 and no state changes (row not created/modified/deleted) → GET/list/subset all succeed for a non-admin user, confirming reads require no special permission.

## Focused edge-case tests

- `given_id` fails schema validation when it contains characters outside `^[A-Za-z0-9_.-]+$` (422), mirroring `test_dataset_given_id_validation`.
- Upload where `file_md5` doesn't match the reconstructed file → task fails with a clear message (this path isn't currently covered for datasets either — worth adding for both, per the research gap noted below).
- Upload where a declared column in `columns` is missing from the parquet file, and where a declared `type` doesn't match the actual parquet column type → task fails identifying the offending column, no partial FlatTable row/sqlite file left behind.
- `flat_table_id` in the subset request that doesn't resolve to any table (bad UUID or unknown given_id) → 404.
- Note: while surveying existing dataset tests, no test currently exercises the analogous `file_md5` mismatch path or the 409 given_id-collision path for datasets — call this out to the team as a gap worth closing alongside the FlatTable work, since FlatTable's md5-mismatch test will need equivalent test infrastructure (or reveal it doesn't exist yet).
