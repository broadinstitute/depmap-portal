# Phase 1: Core Package Upgrades

Phase 1 of the backend Python package upgrade. Replaces `flask-restplus`, upgrades Flask, SQLAlchemy, pandas, and related packages, and adapts the codebase for API compatibility.

## Package upgrades

- **flask-restplus** (0.13.0) replaced with **flask-restx** (^1.3.0) — maintained community fork
- **Flask** 1.x → **^3.1**, **Werkzeug** 0.16.1 → **^3.1**
- **SQLAlchemy** 1.4.40 → **^2.0**, **Flask-SQLAlchemy** 2.x → **^3.1**
- **pandas** 1.x → **^2.0**, **seaborn** 0.11 → **^0.13**
- **Flask-Login** → ^0.6, **Flask-Bcrypt** → ^1.0, **Flask-Caching** → ^2.3, **Flask-DebugToolbar** → ^0.14, **MarkupSafe** → ^3.0, **Flask-WTF** → ^1.2, **Flask-Assets** → ^2.1
- **Flask-Markdown** replaced with **markdown** (^3.4) — Flask-Markdown is unmaintained and incompatible with Flask 3.x
- Removed pinned **sqlalchemy-stubs** — SQLAlchemy 2.0 ships its own type stubs

## Code changes and rationale

### flask-restx migration

Renamed all `flask_restplus` imports to `flask_restx` across the codebase. This is a direct drop-in replacement; `flask-restx` is the actively maintained community fork of the abandoned `flask-restplus`.

**Files**: all files importing `flask_restplus`

### Flask-RESTx route conflict fix

**Problem**: After upgrading to Flask 3.x, the Celligner page (`/celligner/`) showed an empty Swagger UI page instead of the actual application. The download page (`/download/`) had the same latent issue.

**Root cause**: `flask_restx.Api()`, when initialized with a blueprint, registers a hidden `root` endpoint at the blueprint's base URL `/`. In Flask 1.x, the order of `@blueprint.route("/")` vs `Api()` creation didn't matter because Flask preserved explicit route priority. In Flask 3.x, the last-registered route wins, so when `Api()` was created _before_ the app's `@blueprint.route("/")`, the Swagger root endpoint (which returns 404 by default) would shadow it. When `Api()` was created _after_, the reverse happened — but only because of the ordering of statements in the file.

**Fix**: Moved `Api()` creation after `@blueprint.route("/")` definitions in `celligner/views.py` and `download/views.py`. Added `doc=False` to all three internal `Api` instances (`celligner`, `download`, `compute`) to explicitly disable Swagger UI registration, since these are internal-only APIs.

**Files**: `depmap/celligner/views.py`, `depmap/download/views.py`, `depmap/compute/views.py`

### SQLAlchemy 2.0 API updates

Several SQLAlchemy APIs deprecated or removed in 2.0 were updated:

- **`lazy="dynamic"` → `lazy="select"`**: The `dynamic` loading strategy is deprecated. Changed to `select` which returns a list directly, and removed the now-unnecessary `.all()` calls (e.g., `self.lineage.all()` → `self.lineage`).
- **`cls.query.get(pk)` → `db.session.get(cls, pk)`**: `Query.get()` is deprecated; replaced with `Session.get()`.
- **Explicit JOIN ON clauses**: SQLAlchemy 2.0 requires explicit `ON` clauses for joins where the relationship is ambiguous. Added explicit conditions like `.join(RowMatrixIndex, RowMatrixIndex.matrix_id == Matrix.matrix_id)`.
- **`case()` syntax**: Changed from `case([(condition, value)], else_=default)` (list of tuples) to `case((condition, value), else_=default)` (positional args).
- **Raw SQL wrapped in `text()`**: SQLAlchemy 2.0 requires raw SQL strings to be explicitly wrapped in `sqlalchemy.text()`. Updated all `connection.execute("...")` calls to `connection.execute(text("..."))`, and changed positional parameters (`?`) to named parameters (`:name`) with dict-based parameter binding.

**Files**: `depmap/cell_line/models.py`, `depmap/dataset/models.py`, `depmap/compound/legacy_utils.py`, `depmap/context_explorer/models.py`, `depmap/interactive/nonstandard/models.py`, `depmap/interactive/standard/standard_utils.py`, `depmap/partials/matrix/models.py`, `depmap/partials/data_table/models.py`, `depmap/cli_commands/db_load_commands.py`, `depmap/utilities/bulk_load.py`, `tests/loader/test_batch_loader.py`, and others

### Flask 2.2+ JSON provider

**Problem**: `app.json_encoder` was removed in Flask 2.2+.

**Fix**: Replaced the custom `encoder_default_disallow_nan` function with a `DisallowNanJSONProvider` class inheriting from `DefaultJSONProvider`, and set it via `app.json_provider_class`. This preserves the existing behavior of rejecting `NaN`/`Infinity` values in JSON responses.

**Files**: `depmap/extensions.py`

### Werkzeug 3.x compatibility

- **`safe_join`**: Import moved from `werkzeug.utils` to `werkzeug.security` (its new canonical location in Werkzeug 2.x+).
- **`run_with_reloader`**: Import fallback updated to try `werkzeug.serving` first, then `werkzeug._reloader`.

**Files**: `depmap/public/minisites.py`, `depmap/compound_dashboard/views.py`, `depmap/cli_commands/spawn_commands.py`

### pandas 2.x compatibility

- **Internal API imports**: `pd.core.indexes.range.RangeIndex` → `pandas.RangeIndex`, `pd.util.hash_pandas_object` → `pandas.core.util.hashing.hash_pandas_object`. These internal paths were removed from the pandas public namespace in 2.x.
- **`bytes()` cast**: Added explicit `bytes()` cast on `hash_pandas_object(...).values` because pandas 2.x returns `ExtensionArray` which is not directly accepted by `hashlib.update()`.
- **Test assertion update**: `test_gene_loader.py` — pandas 2.x changed how outer merges handle boolean columns (`np.NaN` vs `pd.NA`), causing `df.equals()` to fail on dtype differences. Replaced with semantic assertions that check data shape and key values.

**Files**: `depmap/utilities/hashing_utils.py`, `tests/loader/test_gene_loader.py`

### Pyright import fixes

Changed dotted attribute access (e.g., `sa.orm.aliased()`, `sqlalchemy.exc.IntegrityError`) to direct imports (`from sqlalchemy.orm import aliased`). Pyright cannot resolve attributes through sub-module re-exports, so these show up as errors even though they work at runtime.

**Files**: `depmap/dataset/models.py`, `depmap/compound/legacy_utils.py`, `depmap/cell_line/models.py`, `depmap/utilities/bulk_load.py`, `tests/loader/test_batch_loader.py`

### Other changes

- **Matrix constructor**: Changed `row_index=` / `col_index=` to `_row_index=` / `_col_index=` in `MatrixFactory`, matching the refactored backing attributes for the `lazy="select"` migration. Added `db.session.flush()` after `db.session.add(matrix)` to ensure `matrix_id` is generated.
- **`database.py`**: Updated `Flask-SQLAlchemy` initialization patterns for v3.x compatibility.
- **Dockerfile**: Reads Python version from `.python-version` file instead of hardcoding `3.9`.
- **CI**: Added `backend-package-upgrade-26q1` and `backend-package-upgrade-26q1-phase1` branches to `build_app.yml` trigger list.

## Test plan

- [ ] All existing unit tests pass (`pytest`)
- [ ] `pyright-ratchet` reports 0 new errors
- [ ] QA crawler passes all pages (celligner, download, compute, etc.)
- [ ] Manual smoke test of celligner page, data slicer, and compound dashboard
