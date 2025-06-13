# @depmap/api

A TypeScript client library for accessing DepMap data through two main APIs:
the Legacy Portal API and the Breadbox API.

## Usage

### Basic Import

```typescript
import { legacyPortalAPI, breadboxAPI } from "@depmap/api";
import type { LegacyPortalApiResponse, BreadboxApiResponse } from "@depmap/api";
```

### Legacy Portal API

The Legacy Portal API provides access to data organized by resource type:

```typescript
// Get cell line compound sensitivity data
const sensitivityData = await legacyPortalAPI.getCellLineCompoundSensitivityData(
  "ACH-000001"
);

// Get dose response curves for compounds
const doseResponse = await legacyPortalAPI.getDoseResponsePoints(
  "PRISM",
  "ACH-000001",
  "BRD-K12345"
);

// Get oncogenic alterations for a cell line
const alterations = await legacyPortalAPI.getOncogenicAlterations("ACH-000001");

// Download dataset metadata
const datasets = await legacyPortalAPI.getDatasetsDownloadMetadata();
```

### Breadbox API

The Breadbox API provides modern data management capabilities:

```typescript
// Access computational resources
const computeResult = await breadboxAPI.compute(/* parameters */);

// Manage datasets
const datasetInfo = await breadboxAPI.getDatasetInfo(/* parameters */);

// Handle file uploads
const uploadResult = await breadboxAPI.uploadFile(/* parameters */);
```

## Type Safety

Both APIs provide full TypeScript support with response types:

```typescript
// Legacy Portal API response types
type LegacyResponse = LegacyPortalApiResponse["getCellLineCompoundSensitivityData"];

// Breadbox API response types
type BreadboxResponse = BreadboxApiResponse["someMethod"];
```

## Error Handling

All API methods return Promises and should be wrapped in try-catch blocks:

```typescript
try {
  const data = await legacyPortalAPI.getCellLineCompoundSensitivityData(
    "ACH-000001"
  );
  // Process data
} catch (error) {
  console.error("API request failed:", error);
}
```
