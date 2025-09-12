# Architecture and Layers

Recently we have made efforts to move towards a 3-layered architecture. Although this is still a work in progress, here is the general idea of each layer. Note that in an ideal scenario, all communication goes through the application layer. The presentation/API layer and the data layer should not communicate directly with one another.

For now, our service layer just contains more complex business logic such as additional validation and multiple complex queries or CRUD operations. We tend to keep our CRUD layer functions simpler such as they make simple DB operations. Our presentation/API layer does directly call some CRUD functions currently such as `GET /datasets` just calls our crud function get_dataset(). However, this is done mostly as a backwards compatibility and we should keep in mind the ideal layers going forward.

## Presentation Layer (API Layer)

- Exposes the API endpoints that client applications interact with.
- Handles incoming HTTP requests (GET, POST, PUT, DELETE) and translates them into calls to the application layer.

## Application Layer (Service Layer)

- This layer contains the business logic and orchestrates operations.
- Receives requests from the presentation layer, validates data, and interacts with the data layer to perform CRUD operations.
- May include services that encapsulate specific business rules and workflows.

## Data Access Layer

- Responsible for interacting with the data persistence (i.e. database)
- Abstracts away the details of database operations
- Performs the actual Create, Read, Update, and Delete operations on the data storage

---

# Project Structure

Breadbox project uses Poetry which influences the below nested structure:

- **Outer `/breadbox` folder**: top-level configuration, scripts, tests, and docs

- **Inner `/breadbox` folder**: application-specific logic

---

## Directory Tree

### Outer `/breadbox` folder

- [`/tests`](../tests/)
  - In general the folder structure should match the application folder structure
  - We mostly test the response outputs from the api level
- [`/docs`](../docs/): Contains docs related to breadbox

#### Key Files

- [`commands.py`](../commands.py): Defines Breadbox commands.

- [`.env.dev`](../.env.dev): Template `.env` file (copy to .env for local setup).

- `.env`: Environment variables for running Breadbox. These map to settings in breadbox/breadbox/config.py.

- [`pyproject.toml`](../pyproject.toml): Poetry project definition (includes Commitizen rules).

- [`poetry.lock`](../poetry.lock): Dependency lock file.

### Inner /breadbox Folder

The subfolders align with the main Breadbox application layers:

- [/api](../breadbox/api/) – Presentation/API layer.

  - Each file maps to a route prefix (grouping related endpoints).

  - Exception: /temp subfolder contains experimental/unrelated routes.

- [/celery_task](../breadbox/celery_task/) – Helpers for Celery tasks.

- [/compute](../breadbox/compute/)

  - Contains task files.

  - celery.py – Celery configuration and entry point.

- [/crud](../breadbox/crud) – Data access layer.

  - Contains minimal DB operations (ideally one table per function).

  - Complex/multi-table queries should go into the /service layer.

  - Generally maps to an /api file or Breadbox entity.

- [/db](../breadbox/db) – Database configuration.

- [/io](../breadbox/io) – Data I/O logic.

  - Reading/writing slices from HDF5 files.

  - Alternate storage support (Google Cloud Storage, SqliteDict cache).

- [/models](../breadbox/models) – SQLAlchemy models mapped to database tables.

- [/schemas](../breadbox/schemas) – Pydantic models.

  - Provide typing, validation, and serialization for API params/responses.

  - Typically grouped by corresponding /api files.

- [/service](../breadbox/service) – Application/Service layer.

  - Encapsulates complex queries across multiple DB tables.

  - Maps to main entities/concepts in Breadbox.

- [/ui](../breadbox/ui) – SPA integration.

  - Defines a custom FastAPI static file handler (SinglePageApplication).

  - Supports serving frontend assets (e.g., React apps).

  - Introduced for Elara integration.

- [/utils](../breadbox/utils) – Currently only contains a simple assert helper.

#### Key Files

- [`config.py`](../breadbox/config.py): FastAPI configs and settings.

- [`logging.py`](../breadbox/logging.py): Logging to stdout + Google Cloud Error Reporting.

- [`main.py`](../breadbox/main.py): FastAPI entry point; includes decorators for custom error handling.

- [`startup.py`](../breadbox/startup.py): Configures the application, sets up middleware (e.g., override HTTP schema and host headers).
