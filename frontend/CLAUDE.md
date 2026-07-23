# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the frontend monorepo for the DepMap Portal, a web application for cancer dependency map data. It uses Yarn Workspaces to manage multiple packages. There are two main frontend applications and many shared `@depmap/*` libraries.

## Common Commands

```bash
# Install dependencies (run from frontend/ directory)
yarn install

# Development servers
yarn dev:portal          # Portal frontend on http://127.0.0.1:5001 (requires Flask on :5000)
yarn dev:portal:nocheck  # Faster compilation, no TypeScript errors shown
yarn dev:elara           # Elara frontend on http://localhost:8001 (requires Breadbox on :8000)
yarn dev:elara:nocheck   # Faster compilation

# Run all tests across all packages
yarn test

# Run tests for a specific package
yarn workspace portal-frontend test
yarn workspace @depmap/data-explorer-2 test

# Run a single test file
cd packages/portal-frontend && npx jest src/__tests__/someFile.test.ts

# Run storybook for a package
cd packages/@depmap/common-components && yarn storybook

# Build for production
yarn build:portal
yarn build:elara

# Clear eslint cache (useful when eslint gets stuck)
yarn clear-eslint-cache
```

## Architecture

### Main Applications

- **portal-frontend**: Full-featured public DepMap portal. Renders React components into DOM elements provided by a Flask/Jinja backend running on port 5000. Uses dynamic imports with `React.lazy()` for code splitting.

- **elara-frontend**: Internal on-prem portal with limited features (Data Explorer, Custom Analyses, Downloads, Datasets, Groups). A standalone React SPA using react-router-dom, backed by Breadbox.

### Shared Packages (@depmap/\*)

Located in `packages/@depmap/`, these are private workspace packages (not published to npm):

- **@depmap/api**: API client layer with `legacyPortalAPI` (Flask backend) and `breadboxAPI` (Breadbox backend)
- **@depmap/types**: Shared TypeScript type definitions
- **@depmap/common-components**: Reusable React components (Spinner, modals, buttons, etc.)
- **@depmap/data-explorer-2**: Data exploration UI components
- **@depmap/compute**: Computation-related utilities
- **@depmap/cell-line-selector**: Cell line selection component
- **@depmap/custom-analyses**: Custom analysis tools
- **@depmap/dataset-manager**: Dataset management UI
- **@depmap/groups-manager**: User groups management
- **@depmap/downloads**: Download functionality
- **@depmap/plotly-wrapper**: Plotly.js wrapper components
- **@depmap/wide-table**, **@depmap/long-table**, **@depmap/slice-table**, **@depmap/react-table**: Table components
- **@depmap/utils**: General utilities
- **@depmap/globals**: Global state and configuration

### API Pattern

The `@depmap/api` package exports two main clients:

- `legacyPortalAPI`: For Flask backend calls (portal-frontend)
- `breadboxAPI`: For Breadbox backend calls (elara-frontend, some portal features)

Both use typed response interfaces (`LegacyPortalApiResponse`, `BreadboxApiResponse`). Use `cached()` decorator for cacheable API calls.

## Testing

- Test framework: Jest with jsdom environment
- React testing: React Testing Library recommended, Enzyme also available
- Test files pattern: `__tests__/*.test.{ts,tsx}`
- API mocking: Tests auto-mock `@depmap/api`. To provide mock responses:

```typescript
import { legacyPortalAPI, breadboxAPI } from "@depmap/api";

legacyPortalAPI.someMethod = jest
  .fn<ReturnType<typeof legacyPortalAPI.someMethod>, []>()
  .mockResolvedValue(/* mock data */);
```

Mocks are automatically reset after each test.

## Styling

- Sass files (`.scss`) used with CSS Modules
- Import styles as: `import styles from "./Component.scss"`
- Bootstrap 3 is available globally
