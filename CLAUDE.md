# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is the DepMap Portal monorepo — a cancer dependency map website. It consists of several interconnected services:

- **`breadbox/`** — FastAPI-based persistent data storage service (Python 3.9+, SQLAlchemy + Alembic, Celery workers)
- **`portal-backend/`** — Legacy Flask backend with a transient database rebuilt each deployment
- **`frontend/`** — Yarn Workspaces monorepo with two React apps and many shared `@depmap/*` packages
- **`breadbox-client/`** — Auto-generated Python client for the Breadbox API (`breadbox_client/`) plus a higher-level facade (`breadbox_facade/`)
- **`breadbox-client-generator/`** — Tool that generates `breadbox-client` from the OpenAPI spec
- **`pipeline/`** — Preprocessing pipeline (conseq-based)

Sub-directories each have their own CLAUDE.md with detailed guidance:

- `breadbox/CLAUDE.md` — Breadbox service architecture, test fixtures, DB migrations
- `frontend/CLAUDE.md` — Frontend apps, shared packages, testing patterns

## Local Development Setup

Each service has its own `install_prereqs.sh`:

```bash
# Install system dependencies (once)
brew install redis yarn node
pipx install poetry

# Breadbox
cd breadbox && ./install_prereqs.sh && poetry shell

# Portal backend
cd portal-backend && ./install_prereqs.sh
```

## Running Services Locally

Services must be started in order (Breadbox first, then portal-backend):

```bash
# 1. Start Redis
redis-server

# 2. Start Breadbox (port 8000)
cd breadbox && poetry shell
./bb run                  # http://127.0.0.1:8000/docs
./bb run_worker           # background Celery worker

# 3. Create/populate dev databases (both legacy DB and Breadbox)
cd portal-backend
./flask recreate_dev_db

# 4. Start portal-backend (port 5000)
./flask run
./flask run_dev_worker    # background Celery worker (requires redis)

# 5. Start frontend dev server (port 5001, requires Flask on :5000)
cd frontend
yarn dev:portal

# OR start Elara (port 8001, requires Breadbox on :8000)
yarn dev:elara
```

## Common Commands

### Breadbox (`breadbox/`)

```bash
poetry shell              # activate virtualenv
./bb run                  # start app
./bb upgrade-db           # apply DB migrations
./bb recreate-dev-db      # reset DB with sample data
./bb update-client        # regenerate breadbox-client from OpenAPI spec
./bb shell                # interactive shell with db/settings loaded
pytest                    # run all tests
pytest tests/api/test_datasets.py::test_name  # run single test
pytest --runslow          # include slow tests
pytest --skipcelery       # skip celery tests
alembic revision --autogenerate -m "description"  # create DB migration
```

### Portal Backend (`portal-backend/`)

```bash
poetry shell
./flask run
./flask recreate_dev_db           # minimal dev data
./flask recreate_dev_db -nct      # include nonstandard/celligner/tda data
pytest
pytest tests/depmap/context/test_models.py::test_name
mypy .                    # type checking
lint-imports              # check import dependency rules (.importlinter)
```

### Frontend (`frontend/`)

```bash
yarn install
yarn dev:portal           # portal on :5001
yarn dev:elara            # elara on :8001
yarn test                 # all tests
yarn workspace @depmap/data-explorer-2 test  # single package tests
yarn build:portal
yarn build:elara
```

## Architecture

### Data Flow

The portal has two backends:

1. **Breadbox** — stores most dataset data used in visualizations; persistent SQLite/Postgres database
2. **Legacy portal-backend** — Flask app with a transient SQLite database rebuilt from S3 on each deployment; handles downloads, some metadata, and features not yet migrated to Breadbox

The frontend (`@depmap/api` package) exports:

- `legacyPortalAPI` — calls to Flask backend
- `breadboxAPI` — calls to Breadbox

### breadbox-client relationship

- `breadbox_client/` — auto-generated from OpenAPI spec via `./bb update-client`; do not edit manually
- `breadbox_facade/client.py` — higher-level wrapper around `breadbox_client` with retries, pandas integration, and convenience methods; this is what other services import

When Breadbox API changes, run `./bb update-client` to regenerate `breadbox_client`, then update `breadbox_facade` if needed.

### Portal Backend Structure (`portal-backend/depmap/`)

Each feature area is a Flask Blueprint in its own subdirectory (e.g., `gene/`, `compound/`, `cell_line/`, `dataset/`). The pattern is:

- `views.py` — Flask routes and Blueprint registration
- `models.py` — SQLAlchemy models
- Tests mirror the `depmap/` directory structure under `tests/depmap/`

Key cross-cutting concerns:

- `access_control/` — row-level security based on user identity from oauth2_proxy headers
- `data_access/` — abstraction layer over Breadbox and legacy data
- `breadbox_shim/` — adapter code for Breadbox integration
- `vector_catalog/` — dynamic dataset feature catalog

### Frontend Architecture

Two applications:

- **portal-frontend** — renders React into DOM elements provided by Flask/Jinja templates; uses Webpack code splitting with separate bundles per page
- **elara-frontend** — standalone React SPA (react-router-dom) backed by Breadbox only

Shared packages in `frontend/packages/@depmap/` are private Yarn Workspace packages (not published to npm).

### Adding a New Portal Page

1. Create Jinja template in `portal-backend/depmap/templates/MY_APP/index.html`
2. Create Flask Blueprint in `portal-backend/depmap/MY_APP/views.py`
3. Register blueprint in `portal-backend/depmap/app.py`
4. Create React app in `frontend/packages/portal-frontend/src/apps/MY_APP.tsx`
5. Add Webpack entry in `frontend/packages/portal-frontend/webpack.common.js`

## Commit Conventions

Use commitizen-style scoped commits (especially for Breadbox, which uses them for auto-versioning):

```
feat(breadbox): new feature       → MINOR version bump
fix(breadbox): bug fix            → PATCH version bump
feat(breadbox)!: breaking change  → MAJOR version bump
build/chore/test/refactor/docs/perf/ci(breadbox): ...
```

Run `poetry run cz c` from `breadbox/` for interactive commit formatting.

## Representative Sample Data

When testing with dev data, these entities have complete data across all features:

- **Gene**: SOX10
- **Compound**: afatinib
- **Cell line**: UACC62 (ACH-000425)
- **Private dataset**: "Canary dataset" (visible to `canary@sample.com` or `*@canary.com`)
