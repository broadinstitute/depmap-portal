# Custom Analyses

A React-based UI for configuring and running univariate association analyses against the DepMap portal data or custom datasets.

## Overview

The Custom Analyses page allows users to configure one of two analysis types:

- **Pearson Correlation** — Computes correlation between a selected feature/slice and all features in a dataset
- **Two Class Comparison** — Compares two groups of samples (e.g., cell lines with vs. without a mutation)

Once configured, the analysis is submitted as a Celery task. Results open in Data Explorer in a new tab.

## Architecture

The page uses a reducer-based state management pattern:

- `analysisReducer` manages the `AnalysisConfiguration` state as a discriminated union (keyed by `kind`)
- `useAnalysisQueryString` syncs the configuration to the URL query string, enabling shareable/bookmarkable links
- `useValidator` validates that referenced datasets and features still exist
- `useRunHandler` submits the analysis and displays progress in a modal

## URL Synchronization

Complete configurations are synced to the URL query string. This enables:

- Sharing a link to a pre-filled analysis configuration
- Browser back/forward navigation between configurations
- Bookmarking a configuration for later use

Large context objects (filter expressions, group definitions) are stored in Content Addressable Storage and referenced by hash to keep URLs manageable.

When results open in Data Explorer, the original configuration is packaged as a base64-encoded `analysisConfig` param. Data Explorer can use this to link back to the original Custom Analyses configuration.

## API

Currently uses the legacy `computeUnivariateAssociations` endpoint via `breadboxAPI`. The UI has been designed to make migrating to new Breadbox endpoints straightforward — the API calls are isolated in `api/` and the configuration types already map closely to the expected new API shape.

## Key Files

| File                                     | Purpose                                   |
| ---------------------------------------- | ----------------------------------------- |
| `components/index.tsx`                   | Main page component                       |
| `components/AnalysisConfigurationPanel/` | Form UI for configuring analyses          |
| `reducers/analysisReducer.ts`            | State management for the configuration    |
| `hooks/useAnalysisQueryString.ts`        | URL ↔ state synchronization               |
| `hooks/useRunHandler.tsx`                | Analysis submission and progress tracking |
| `types/AnalysisConfiguration.ts`         | TypeScript types for the configuration    |
| `utils/getDataExplorerLink.ts`           | Builds the Data Explorer URL for results  |
