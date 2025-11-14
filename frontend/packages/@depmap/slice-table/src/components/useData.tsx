import React, { useEffect, useState, useRef, useCallback } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { ExternalLink, WordBreaker } from "@depmap/common-components";
import { isElara, toPortalLink } from "@depmap/globals";
import Papa from "papaparse";
import type {
  Dataset,
  DimensionType,
  MatrixDataset,
  SliceQuery,
} from "@depmap/types";

// Types for better code clarity
type DatasetResponse = Record<string, Record<string, string | number>>;
type LabelLookup = { id: string; label: string }[];
type ColumnRenames = Record<string, string>;

export interface RowFilters {
  hideUnselectedRows: boolean;
  hideIncompleteRows: boolean;
}

interface AlignedData {
  columns: Array<{
    id: string;
    accessorFn: (row: Record<string, unknown>) => unknown;
    header: () => React.ReactNode;
    meta: {
      idLabel: string;
      units: string;
      value_type: string | null;
      datasetName: string;
      csvHeader: string;
      sliceQuery: SliceQuery;
      isEditable: boolean;
      isViewable: boolean;
    };
  }>;
  data: Record<string, string | number | undefined>[];
  loading: boolean;
  error: string | null;
  exportToCsv: () => string;
}

/**
 * Generates a unique column key for table data alignment.
 * This ensures that the same identifier from different datasets gets unique column keys.
 */
export function createUniqueColumnKey(slice: SliceQuery): string {
  if (slice.identifier === "label") {
    return "label";
  }

  return `${slice.dataset_id}__${slice.identifier_type}__${slice.identifier}`;
}

/**
 * Extracts column rename mappings from dataset preprocessing metadata.
 *
 * This is a workaround for Breadbox's current limitations - we parse the preprocessing
 * string to find column renames that were applied during data ingestion. This helps us
 * display the original, more readable column names to users.
 *
 * TODO: Extend Breadbox API to expose rename mappings directly rather than requiring
 * string parsing of preprocessing metadata.
 */
async function extractColumnRenames(
  metadataDatasetId: string
): Promise<ColumnRenames> {
  try {
    const datasets = await cached(breadboxAPI).getDatasets();
    const metadata = datasets.find(({ id }) => id === metadataDatasetId);
    const datasetMetadata = metadata?.dataset_metadata;

    // Handle different dataset_metadata structures
    let preprocess: string | undefined;
    if (
      datasetMetadata &&
      typeof datasetMetadata === "object" &&
      "preprocess" in datasetMetadata
    ) {
      preprocess = datasetMetadata.preprocess;
    }

    if (!preprocess) {
      return {};
    }

    const renamesMatch = preprocess.match(/renames\s*=\s*\{[^}]+\}/);
    if (!renamesMatch) {
      return {};
    }

    const renamesString = renamesMatch[0]
      .replace(/^renames\s*=\s*/, "")
      .replace(/'/g, '"');

    const renames = JSON.parse(renamesString);

    // Invert the mapping: renames typically maps old_name -> new_name,
    // but we want new_name -> old_name for display purposes
    return Object.fromEntries(
      Object.entries(renames).map(([key, value]) => [value, key])
    );
  } catch (error) {
    window.console.warn("Failed to extract column renames:", error);
    return {};
  }
}

const isLinkable = (dimension_type?: string | null) =>
  !isElara &&
  dimension_type &&
  ["depmap_model", "gene", "compound_v2"].includes(dimension_type);

function toDetailPageLink(id: string, label: string, dimension_type: string) {
  let href = "";

  if (dimension_type === "depmap_model") {
    href = toPortalLink(`/cell_line/${id}`);
  }

  if (dimension_type === "gene") {
    href = toPortalLink(`/gene/${label}`);
  }

  if (dimension_type === "compound_v2") {
    href = toPortalLink(`/compound/${label}`);
  }

  return <ExternalLink href={href}>{id}</ExternalLink>;
}

/**
 * Builds the list of slices to fetch, always including the required metadata columns.
 *
 * For every index type, we need:
 * 1. The "label" column from the metadata dataset (for human-readable names)
 * 2. Any user-requested slices
 */
function buildSlicesToFetch(
  indexType: DimensionType,
  userSlices: SliceQuery[]
): SliceQuery[] {
  if (!indexType.metadata_dataset_id) {
    throw new Error(
      `Dimension type "${indexType.name}" does not have a \`metadata_dataset_id\`!`
    );
  }

  const labelSlice: SliceQuery = {
    dataset_id: indexType.metadata_dataset_id,
    identifier_type: "column",
    identifier: "label",
  };

  // We always add an `id` and `label` column so filter out any redundancies.
  const novelSlices = userSlices.filter((s) => {
    if (s.identifier_type !== "column") {
      return true;
    }

    return s.identifier !== "label" && s.identifier !== indexType.id_column;
  });

  return [labelSlice, ...novelSlices];
}

/**
 * Determines the appropriate API call and parameters for fetching a data slice.
 *
 * The fetch strategy depends on:
 * - Slice type: "column" uses tabular API, others use matrix API
 * - Index axis: determines whether we're querying by sample or feature
 * - Identifier type: determines whether to use ID or label for lookup
 */
function createDataFetchPromise(slice: SliceQuery, indexType: DimensionType) {
  if (slice.identifier_type === "column") {
    // Tabular dataset: fetch specific columns
    return cached(breadboxAPI).getTabularDatasetData(slice.dataset_id, {
      columns: [slice.identifier],
    });
  }

  if (indexType.axis === "sample") {
    // Matrix dataset, sample axis: we're querying for features
    if (["sample_id", "sample_label"].includes(slice.identifier_type)) {
      throw new Error(
        `Slice identifier_type "${slice.identifier_type}" is incompatible with sample axis index type`
      );
    }

    return cached(breadboxAPI).getMatrixDatasetData(slice.dataset_id, {
      feature_identifier:
        slice.identifier_type === "feature_id" ? "id" : "label",
      features: [slice.identifier],
    });
  }

  // Matrix dataset, feature axis: we're querying for samples
  if (["feature_id", "feature_label"].includes(slice.identifier_type)) {
    throw new Error(
      `Slice identifier_type "${slice.identifier_type}" is incompatible with feature axis index type`
    );
  }

  return cached(breadboxAPI).getMatrixDatasetData(slice.dataset_id, {
    sample_identifier: slice.identifier_type === "sample_id" ? "id" : "label",
    samples: [slice.identifier],
  });
}

/**
 * Creates the appropriate promise for fetching label information for a slice.
 *
 * For tabular datasets, we create a simple mapping from identifier to itself.
 * For matrix datasets, we fetch the full feature/sample metadata to get labels.
 */
function createLabelFetchPromise(
  slice: SliceQuery,
  indexType: DimensionType
): Promise<LabelLookup> {
  if (slice.identifier_type === "column") {
    // For tabular datasets, the identifier is the label
    return Promise.resolve([{ id: slice.identifier, label: slice.identifier }]);
  }

  // For matrix datasets, fetch the appropriate metadata
  if (indexType.axis === "sample") {
    return cached(breadboxAPI).getDatasetFeatures(slice.dataset_id);
  }

  return cached(breadboxAPI).getDatasetSamples(slice.dataset_id);
}

const truncateMiddle = (str: string, maxLength = 45): string => {
  if (str.length <= maxLength) {
    return str;
  }

  const ellipsis = "…";
  const charsToShow = maxLength - ellipsis.length;
  const frontChars = Math.ceil(charsToShow / 2);
  const backChars = Math.floor(charsToShow / 2);

  const start = str.slice(0, frontChars);
  const end = str.slice(-backChars);

  return `${start}${ellipsis}${end}`;
};

/**
 * Applies row filters to the data.
 *
 * @param data - Array of data rows
 * @param filters - Row filter configuration
 * @param selectedRowIds - Set of selected row IDs (for hideUnselectedRows filter)
 * @returns Filtered data array
 */
function applyRowFilters(
  data: Record<string, string | number | undefined>[],
  filters: RowFilters,
  selectedRowIds?: Set<string>
) {
  return data.filter((row) => {
    // Apply hideUnselectedRows filter
    if (filters.hideUnselectedRows && selectedRowIds) {
      const rowId = row.id as string;
      if (!selectedRowIds.has(rowId)) {
        return false;
      }
    }

    // Apply hideIncompleteRows filter
    if (filters.hideIncompleteRows) {
      // Check if any data columns (excluding id and label) have undefined values
      const hasUndefinedValues = Object.entries(row).some(([key, value]) => {
        // Skip id and label columns for completeness check
        if (key === "id" || key === "label") {
          return false;
        }
        return value === undefined;
      });

      if (hasUndefinedValues) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Transforms raw API responses into a unified table structure.
 *
 * This function:
 * 1. Collects all unique row IDs across all data slices
 * 2. Creates rows where each ID gets values from all slices (with null for missing data)
 * 3. Generates table column definitions with proper headers and metadata
 * 4. Applies row filters if specified
 */
function transformToTableData(
  dataResponses: DatasetResponse[],
  labelResponses: LabelLookup[],
  slices: SliceQuery[],
  viewOnlySlices: Set<SliceQuery> | undefined,
  datasets: Dataset[],
  indexType: DimensionType,
  idColumnDisplayName: string,
  labelColumnDisplayName: string,
  idToLabelMappings: Record<string, Record<string, string>>,
  rowFilters?: RowFilters,
  selectedRowIds?: Set<string>
) {
  // Step 1: Create unique column keys and collect all row IDs
  const columnKeys = slices.map(createUniqueColumnKey);
  const allRowIds = new Set<string>();
  const columnData: Record<string, Record<string, string | number | null>> = {};

  // Process each data response and collect row IDs
  dataResponses.forEach((response, index) => {
    const firstKey = Object.keys(response)[0];
    let keyedValues: Record<string, string | number | null> = {};

    if (Object.keys(response).length === 0) {
      return;
    }

    if (Object.keys(response).length === 1) {
      keyedValues = response[firstKey];
    } else {
      const firstNestedKey = Object.keys(response[firstKey])[0];
      keyedValues = Object.fromEntries(
        Object.entries(response).map(([key, value]) => [
          key,
          value[firstNestedKey],
        ])
      );
    }

    const uniqueKey = columnKeys[index];
    columnData[uniqueKey] = keyedValues;
    Object.keys(keyedValues).forEach((id) => allRowIds.add(id));
  });

  // Step 2: Build data rows
  let data = Array.from(allRowIds).map((rowId) => {
    const row: Record<string, string | number | undefined> = { id: rowId };

    columnKeys.forEach((columnKey) => {
      // Use `undefined` instead of `null` for missing values because it
      // works better with table sorting (react-table columns have a
      // `sortUndefined: "last"` option but no equivalent for nulls).
      row[columnKey] = columnData[columnKey]?.[rowId] ?? undefined;
    });

    return row;
  });

  // Step 2.5: Apply row filters if specified
  if (rowFilters) {
    data = applyRowFilters(data, rowFilters, selectedRowIds);
  }

  const ID_AND_LABEL_COLUMN_SIZE = 160;

  const shouldRenderIdsAsLinks = isLinkable(indexType.name);

  // Step 3: Build column definitions
  const idColumn = {
    id: "id",
    accessorFn: (row: Record<string, unknown>) => row.id,
    meta: {
      isEditable: false,
      isViewable: false,
      idLabel: idColumnDisplayName,
      units: "",
      datasetName: "",
      value_type: "text",
      csvHeader: idColumnDisplayName,
      sliceQuery: {
        dataset_id: indexType.metadata_dataset_id!,
        identifier_type: "column" as const,
        identifier: indexType.id_column,
      },
    },
    header: () => idColumnDisplayName,
    size: ID_AND_LABEL_COLUMN_SIZE,
    cell: ({
      getValue,
      row,
    }: {
      getValue: () => unknown;
      row: { original: Record<string, unknown> };
    }) => {
      const id = getValue() as string;
      const label = row.original.label as string;

      return id != null && shouldRenderIdsAsLinks
        ? toDetailPageLink(id, label, indexType.name)
        : id;
    },
  };

  const dataColumns = slices.map((slice, index) => {
    const columnKey = columnKeys[index];

    // Find the display label for this slice
    const labelData = labelResponses[index];
    let displayLabel =
      labelData.find((item) => item.id === slice.identifier)?.label ||
      slice.identifier;

    // Special case: use the readable name for the label column (always first slice)
    if (index === 0 && slice.identifier === "label") {
      displayLabel = labelColumnDisplayName;
    }

    const dataset = datasets.find(
      (d) => d.given_id === slice.dataset_id || d.id === slice.dataset_id
    );

    if (!dataset) {
      throw new Error(`Unknown dataset "${slice.dataset_id}"`);
    }

    // Find the dataset name (empty for tabular datasets)
    const datasetName =
      slice.identifier_type === "column" ? "" : dataset.name || "";

    // Find the dataset units (empty for tabular datasets)
    const units =
      slice.identifier_type === "column"
        ? ""
        : (dataset as MatrixDataset).units || "";

    const value_type =
      dataset.format === "matrix_dataset"
        ? dataset.value_type
        : dataset.columns_metadata[slice.identifier].col_type;

    const references =
      dataset.format === "tabular_dataset"
        ? dataset.columns_metadata[slice.identifier].references
        : null;

    return {
      size: columnKey === "label" ? ID_AND_LABEL_COLUMN_SIZE : undefined,
      id: columnKey,
      meta: {
        isEditable: columnKey !== "label" && !viewOnlySlices?.has(slice),
        isViewable: columnKey !== "label",
        idLabel: displayLabel,
        units,
        value_type,
        datasetName,
        csvHeader: [displayLabel, units, datasetName]
          .filter(Boolean)
          .join(" | "),
        sliceQuery: slice,
      },
      accessorFn: (row: Record<string, unknown>) => row[columnKey],
      header: () => (
        <div>
          <WordBreaker text={truncateMiddle(displayLabel)} />
          {datasetName && (
            <>
              <br />
              <WordBreaker text={datasetName} />
            </>
          )}
        </div>
      ),
      // Add a custom cell renderer if we can turn the value into a hyperlink.
      ...(isLinkable(references) && {
        cell: ({
          getValue,
        }: {
          getValue: () => unknown;
          row: { original: Record<string, unknown> };
        }) => {
          const value = getValue();

          return value == null ? (
            <></>
          ) : (
            toDetailPageLink(
              getValue() as string,
              idToLabelMappings[references!][value as string],
              references as string
            )
          );
        },
      }),
      // Add a custom cell renderer for string lists.
      ...(value_type === "list_strings" && {
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const value = getValue();
          return value == null ? <></> : (value as string[]).join(", ");
        },
      }),
    };
  });

  return {
    data,
    columns: [idColumn, ...dataColumns],
  };
}

/**
 * Custom hook for aligning disparate data slices to a shared index.
 *
 * This hook takes an index type and a list of data slices, then:
 * 1. Fetches metadata about the index type (including display name mappings)
 * 2. Fetches data for each slice using the appropriate API (tabular vs matrix)
 * 3. Aligns all data to the shared index ID space
 * 4. Applies row filters if specified
 * 5. Returns table-ready data structures for @tanstack/react-table
 *
 * The "shared index" refers to aligning all data by the same set of IDs - for example,
 * if using "depmap_model" as the index, all data will be aligned by model IDs like "ACH-000001".
 */
export default function useAlignedData({
  index_type_name,
  slices,
  viewOnlySlices = undefined,
  rowFilters = undefined,
  selectedRowIds = undefined,
}: {
  index_type_name: string;
  slices: SliceQuery[]; // Make sure to memoize this!
  viewOnlySlices?: Set<SliceQuery>; // Make sure to memoize this!
  rowFilters?: RowFilters; // Make sure to memoize this!
  selectedRowIds?: Set<string>; // Make sure to memoize this!
}): AlignedData {
  const [state, setState] = useState<AlignedData>({
    columns: [],
    data: [],
    loading: false,
    error: null,
    exportToCsv: () => "",
  });

  // Use refs to store metadata that triggers the data fetch effect
  const indexTypeRef = useRef<DimensionType | null>(null);
  const idColumnDisplayNameRef = useRef<string>("");

  // Create CSV export callback that has access to current state
  const exportToCsv = useCallback(() => {
    if (!state.columns.length || !state.data.length) {
      return "";
    }

    // Determine if we should include the selection column
    const shouldIncludeSelectionColumn =
      selectedRowIds &&
      selectedRowIds.size > 0 &&
      (!rowFilters || !rowFilters.hideUnselectedRows);

    // Create headers from column definitions
    const headers = state.columns.map((column) => column.meta.csvHeader);

    // Insert selection column header after ID (second position) if needed
    if (shouldIncludeSelectionColumn) {
      headers.splice(1, 0, "Selected");
    }

    // Transform data to match column order and convert values to strings
    const csvData = state.data.map((row) => {
      const rowData = state.columns.map((column) => {
        const value = column.accessorFn(row);
        // Handle null, undefined, and other falsy values
        if (value === null || value === undefined) {
          return "";
        }
        return String(value);
      });

      // Insert selection status after ID (second position) if needed
      if (shouldIncludeSelectionColumn) {
        const rowId = row.id as string;
        const isSelected = selectedRowIds.has(rowId);
        rowData.splice(1, 0, isSelected ? "Yes" : "No");
      }

      return rowData;
    });

    // Use Papaparse to generate CSV string
    return Papa.unparse({
      fields: headers,
      data: csvData,
    });
  }, [state.columns, state.data, selectedRowIds, rowFilters]);

  // Combined effect: Load index type metadata and data
  useEffect(() => {
    let isCancelled = false;

    const loadData = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        // Step 1: Load index type metadata
        const indexType = await cached(breadboxAPI).getDimensionType(
          index_type_name
        );

        if (isCancelled) return;

        let idColumnDisplayName = indexType.id_column;

        // Try to get the original, more readable column names
        let labelColumnDisplayName = "label";

        if (indexType.metadata_dataset_id) {
          const renames = await extractColumnRenames(
            indexType.metadata_dataset_id
          );
          idColumnDisplayName =
            renames[indexType.id_column] || indexType.id_column;
          labelColumnDisplayName = renames.label || "label";
        }

        if (isCancelled) return;

        // Store in refs for dependency tracking
        indexTypeRef.current = indexType;
        idColumnDisplayNameRef.current = idColumnDisplayName;

        // Step 2: Load data if we have slices to fetch
        const slicesToFetch = buildSlicesToFetch(indexType, slices);

        // Create all the fetch promises
        const dataPromises = slicesToFetch.map((slice) =>
          createDataFetchPromise(slice, indexType)
        );

        const labelPromises = slicesToFetch.map((slice) =>
          createLabelFetchPromise(slice, indexType)
        );

        const datasetsPromise = cached(breadboxAPI).getDatasets();

        // Execute all fetches in parallel
        const [dataResponses, labelResponses, datasets] = await Promise.all([
          Promise.all(dataPromises),
          Promise.all(labelPromises),
          datasetsPromise,
        ]);

        if (isCancelled) return;

        // Grab the sample/feature labels for any referenced types
        const idToLabelMappings = {} as Record<string, Record<string, string>>;

        for (const slice of slices) {
          const dataset = datasets.find(
            (d) => d.given_id === slice.dataset_id || d.id === slice.dataset_id
          );

          if (!dataset) {
            // eslint-disable-next-line no-continue
            continue;
          }

          const references =
            dataset.format === "tabular_dataset"
              ? dataset.columns_metadata[slice.identifier].references
              : null;

          if (references && !(references in idToLabelMappings)) {
            // eslint-disable-next-line no-await-in-loop
            const identifiers = await cached(
              breadboxAPI
            ).getDimensionTypeIdentifiers(references);

            idToLabelMappings[references] = {};

            identifiers.forEach(({ id, label }) => {
              idToLabelMappings[references][id] = label;
            });
          }
        }

        // Transform the responses into table data
        const { data, columns } = transformToTableData(
          dataResponses,
          labelResponses,
          slicesToFetch,
          viewOnlySlices,
          datasets as Dataset[],
          indexType,
          idColumnDisplayName,
          labelColumnDisplayName,
          idToLabelMappings,
          rowFilters,
          selectedRowIds
        );

        setState((prev) => ({
          ...prev,
          data,
          columns,
          loading: false,
          error: null,
        }));
      } catch (error) {
        if (!isCancelled) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error occurred";
          setState((prev) => ({
            ...prev,
            loading: false,
            error: `Failed to load data: ${errorMessage}`,
          }));
        }
      }
    };

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [index_type_name, slices, viewOnlySlices, rowFilters, selectedRowIds]);

  return {
    columns: state.columns,
    data: state.data,
    loading: state.loading,
    error: state.error,
    exportToCsv,
  };
}
