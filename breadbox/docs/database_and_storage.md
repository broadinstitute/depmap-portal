# DB and Storage

This document describes how Breadbox stores datasets, how the database schema is structured, and how migrations are managed.

---

## Breadbox Datasets

- **Primary storage**: SQLite database.
- **Matrix datasets**:
  - Dimension information is stored in the database.
  - Dimension IDs are also mapped and stored in **HDF5 files**.
  - Values are stored in **HDF5 files** (chosen for historical reasons and decent performance when working with large matrices).
- **Tabular datasets**:
  - Values and dimensions are stored directly in the database.

---

## Storage Locations

- **HDF5 files**: Stored under `/breadbox/app_datasets/`, with each folder corresponding to a dataset ID.
- **Database file**: `sql_app.db`.
- Both locations are configurable via the `.env` file and application `Settings`.

---

## Database Model

See the latest **ERD diagram** here: [Lucidchart](#).

### Main Entity Types

- **Group**: Access control group for datasets.
- **GroupEntry**: Manages group membership and access.
- **Dataset**: Core entity representing data collections, with format constraints for tabular or matrix types.
- **DimensionType**: Defines types of dimensions (features/samples) with axis constraints.
- **Dimension**: Individual dataset dimensions (columns/indexes).
- **DataType**: Conceptual grouping for data types (e.g., CRISPR, Expression).

### Specialized Dataset Types

- **TabularDataset**: Inherits from `Dataset`, represents tabular data.
- **MatrixDataset**: Inherits from `Dataset`, represents matrix/numerical data with value type constraints.

### Specialized Dimensions

- **DatasetFeature**: Column axis for matrix datasets.
- **DatasetSample**: Index axis for matrix datasets.
- **TabularColumn**: Column axis for tabular datasets.

### Data Storage

- **TabularCell**: Stores individual cell values for tabular datasets.

### Supporting Tables

- **PrecomputedAssociation**: Stores precomputed relationships between datasets.
- **DimensionSearchIndex**: Provides a searchable index for dimensions.
- **PropertyToIndex**: Maps properties to searchable indices.

---

## Key Features

- **Cascade deletion** from datasets to related entities.
- **Unique constraints** on critical identifiers.
- **Check constraints** for data integrity (axis values, format types, value types).
- **Comprehensive indexing** for query performance.
- Schema supports **both tabular and matrix formats**, with flexible dimension typing and robust access control through groups.
