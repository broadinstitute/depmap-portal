import React, { useEffect, useState, useRef, useCallback } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { ExternalLink, WordBreaker } from "@depmap/common-components";
import { isPortal, toPortalLink } from "@depmap/globals";
import { serializeSliceQuery } from "@depmap/selects";
import Papa from "papaparse";
import type { Dataset, DimensionType, SliceQuery } from "@depmap/types";

export interface ColumnDisplayOptions {
  header?: ({
    label,
    defaultElement,
  }: {
    label: string;
    defaultElement: React.ReactNode;
  }) => React.ReactNode;
  cell?: ({ getValue }: { getValue: () => unknown }) => React.ReactNode;
  numericPrecision?: number;
  width?: number;
}

interface Parameters {
  index_type_name: string;
  slices: SliceQuery[]; // Make sure to memoize this!
  viewOnlySlices?: Set<SliceQuery>; // Make sure to memoize this!
  getColumnDisplayOptions?: (
    sliceQuery: SliceQuery
  ) => ColumnDisplayOptions | null;
}

// Types for better code clarity
type SliceResponse = {
  ids: string[];
  labels: string[];
  values: (string | number | null)[];
};
type ColumnRenames = Record<string, string>;

export interface RowFilters {
  hideUnselectedRows: boolean;
  hideIncompleteRows: boolean;
  hideRowsWithNoSearchResults: boolean;
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
      numericPrecision?: number;
      headerMenuItems?: (
        | {
            label: string;
            icon: string;
            onClick: () => void;
            disabled?: boolean;
          }
        | {
            widget: "divider";
          }
      )[];
    };
  }>;
  data: Record<string, string | number | undefined>[];
  loading: boolean;
  error: string | null;
  entityLabel: string;
  exportToCsv: (options?: {
    rowFilter?: (row: Record<string, string | number | undefined>) => boolean;
    // When provided, the exported rows are ordered to match this array.
    // Rows not in this array (but passing rowFilter) are appended at the end.
    sortedRowIds?: string[];
    // When provided, only these columns are included in the export.
    visibleColumnIds?: string[];
    selectedRowIds?: Set<string>;
  }) => string;
}

/**
 * Generates a unique column key for table data alignment.
 * This ensures that the same identifier from different datasets gets unique
 * column keys, and that reindex_through chains are distinguished from flat
 * queries to the same leaf column.
 */
export function createUniqueColumnKey(slice: SliceQuery): string {
  if (slice.identifier === "label" && !slice.reindex_through) {
    return "label";
  }

  return serializeSliceQuery(slice);
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

    const renames: Record<string, string> = {};

    const copyColRegex = /CopyColumns\(column_names=\{([^}]*)\}\)/g;
    const hasLabelTransform = preprocess.includes("AppendIdsToLabels");
    let outerMatch: RegExpExecArray | null;

    // eslint-disable-next-line no-cond-assign
    while ((outerMatch = copyColRegex.exec(preprocess)) !== null) {
      const entryRegex = /'([^']+)'\s*:\s*'([^']+)'/g;
      let entryMatch: RegExpExecArray | null;

      // eslint-disable-next-line no-cond-assign
      while ((entryMatch = entryRegex.exec(outerMatch[1])) !== null) {
        if (entryMatch[2] === "label" && hasLabelTransform) {
          // eslint-disable-next-line no-continue
          continue;
        }

        // Invert: value becomes key, key becomes value
        renames[entryMatch[2]] = entryMatch[1];
      }
    }

    return renames;
  } catch (error) {
    window.console.warn("Failed to extract column renames:", error);
    return {};
  }
}

const isLinkable = (dimension_type?: string | null) =>
  isPortal &&
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
  // Reindexed slices can never collide with the table's own metadata columns.
  const novelSlices = userSlices.filter((s) => {
    if (s.reindex_through) {
      return true;
    }

    if (s.identifier_type !== "column") {
      return true;
    }

    return s.identifier !== "label" && s.identifier !== indexType.id_column;
  });

  return [labelSlice, ...novelSlices];
}

/**
 * Fetches the data for a single slice using the dimension data API.
 *
 * This handles all slice types uniformly — tabular columns, matrix
 * features/samples, and reindex_through chains — by delegating to
 * the backend's dimension data endpoint.
 */
function createDataFetchPromise(slice: SliceQuery): Promise<SliceResponse> {
  return cached(breadboxAPI).getDimensionData(slice);
}

/**
 * Resolves a human-readable display label for a slice.
 *
 * For reindex_through chains, composes the outermost link's column name
 * with the fully-resolved leaf label (e.g. "TestArmScreenID › KRAS").
 * Intermediate "door" links are collapsed — they don't represent user
 * decision points, so including them only adds noise.
 *
 * For tabular columns, the identifier is already the column name.
 *
 * For matrix features/samples, fetches metadata to find the label
 * corresponding to the identifier.
 */
async function resolveDisplayLabel(
  slice: SliceQuery,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  indexType: DimensionType
): Promise<string> {
  if (slice.reindex_through) {
    const rootLabel = await resolveLeafLabel(slice);
    // Walk to the deepest reindex_through — that's the hop adjacent to
    // the query dimension, which is the meaningful "door" the user chose.
    // Shallower hops are intermediate plumbing and get collapsed.
    let deepest = slice.reindex_through;
    while (deepest.reindex_through) {
      deepest = deepest.reindex_through;
    }
    return `${deepest.identifier} › ${rootLabel}`;
  }

  return resolveLeafLabel(slice);
}

/**
 * Resolves the label for a single (non-chain) slice. For tabular columns
 * the identifier is the column name; for matrix features/samples we look
 * up the label from the dataset's own metadata.
 *
 * Axis is derived from `identifier_type` rather than an outer `indexType`,
 * because for reindex_through chains the leaf's dataset has no relation
 * to the query dimension's axis.
 */
async function resolveLeafLabel(slice: SliceQuery): Promise<string> {
  if (slice.identifier_type === "column") {
    return slice.identifier;
  }

  const isFeatureAxis = slice.identifier_type.startsWith("feature");
  const metadata = isFeatureAxis
    ? await cached(breadboxAPI).getDatasetFeatures(slice.dataset_id)
    : await cached(breadboxAPI).getDatasetSamples(slice.dataset_id);

  const idOrLabel = slice.identifier_type.endsWith("_id") ? "id" : "label";
  const match = metadata.find((item) => item[idOrLabel] === slice.identifier);
  return match?.label || slice.identifier;
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
 * Transforms raw API responses into a unified table structure.
 *
 * This function:
 * 1. Collects all unique row IDs across all data slices
 * 2. Creates rows where each ID gets values from all slices (with null for missing data)
 * 3. Generates table column definitions with proper headers and metadata
 */
function transformToTableData(
  dataResponses: SliceResponse[],
  displayLabels: string[],
  slices: SliceQuery[],
  viewOnlySlices: Set<SliceQuery> | undefined,
  datasets: Dataset[],
  indexType: DimensionType,
  idColumnDisplayName: string,
  labelColumnDisplayName: string,
  idToLabelMappings: Record<string, Record<string, string>>,
  getColumnDisplayOptions?: Parameters["getColumnDisplayOptions"]
) {
  // Step 1: Create unique column keys and collect all row IDs
  const columnKeys = slices.map(createUniqueColumnKey);
  const allRowIds = new Set<string>();
  const columnData: Record<string, Record<string, string | number | null>> = {};

  // Process each data response and collect row IDs
  dataResponses.forEach((response, index) => {
    const uniqueKey = columnKeys[index];
    const keyed: Record<string, string | number | null> = {};

    for (let i = 0; i < response.ids.length; i++) {
      keyed[response.ids[i]] = response.values[i];
      allRowIds.add(response.ids[i]);
    }

    columnData[uniqueKey] = keyed;
  });

  // Step 2: Build data rows
  const data = Array.from(allRowIds).map((rowId) => {
    const row: Record<string, string | number | undefined> = { id: rowId };

    columnKeys.forEach((columnKey) => {
      // Use `undefined` instead of `null` for missing values because it
      // works better with table sorting (react-table columns have a
      // `sortUndefined: "last"` option but no equivalent for nulls).
      row[columnKey] = columnData[columnKey]?.[rowId] ?? undefined;
    });

    return row;
  });

  const ID_AND_LABEL_COLUMN_SIZE = 160;

  const shouldRenderIdsAsLinks = isLinkable(indexType.name);

  // Check for display options on the id column so consumers can
  // customize its width via getColumnDisplayOptions.
  const idDisplayOptions =
    getColumnDisplayOptions?.({
      dataset_id: indexType.metadata_dataset_id!,
      identifier_type: "column",
      identifier: indexType.id_column,
    }) ?? null;

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
    size: idDisplayOptions?.width ?? ID_AND_LABEL_COLUMN_SIZE,
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

    let displayLabel = displayLabels[index];

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

    // Suppress the dataset name only when the column comes from the index
    // type's own metadata dataset — otherwise a tabular column from a
    // non-metadata table (e.g. "Anchor Screen Table") would render with an
    // ambiguous header that hides why its data are sparse.
    const isMetadataDataset =
      dataset.id === indexType.metadata_dataset_id ||
      dataset.given_id === indexType.metadata_dataset_id ||
      dataset.given_id?.endsWith("_metadata");

    const datasetName =
      slice.identifier_type === "column" && isMetadataDataset
        ? ""
        : dataset.name || "";

    const units =
      dataset.format === "matrix_dataset"
        ? dataset.units
        : dataset.columns_metadata[slice.identifier]?.units;

    const value_type =
      dataset.format === "matrix_dataset"
        ? dataset.value_type
        : dataset.columns_metadata[slice.identifier]?.col_type;

    const references =
      dataset.format === "tabular_dataset"
        ? dataset.columns_metadata[slice.identifier]?.references
        : null;

    // Get per-column display options from the consumer
    const displayOptions = getColumnDisplayOptions
      ? getColumnDisplayOptions(slice)
      : null;

    return {
      size:
        displayOptions?.width ??
        (columnKey === "label" ? ID_AND_LABEL_COLUMN_SIZE : undefined),
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
        ...(displayOptions?.numericPrecision != null && {
          numericPrecision: displayOptions.numericPrecision,
        }),
      },
      accessorFn: (row: Record<string, unknown>) => row[columnKey],
      header: () => {
        const defaultElement = (
          <div>
            <WordBreaker text={truncateMiddle(displayLabel)} />
            {datasetName && (
              <>
                <br />
                <WordBreaker text={datasetName} />
              </>
            )}
          </div>
        );

        return displayOptions?.header
          ? displayOptions.header({
              label: displayLabel,
              defaultElement,
            })
          : defaultElement;
      },
      // Custom cell renderer from getColumnDisplayOptions takes highest priority.
      // When provided, it fully overrides the cell (magnitude bars won't apply).
      ...(displayOptions?.cell && {
        cell: displayOptions.cell,
      }),
      // Built-in cell renderer for linkable references (only if no custom cell).
      ...(!displayOptions?.cell &&
        isLinkable(references) && {
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
      // Built-in cell renderer for string lists (only if no custom cell).
      ...(!displayOptions?.cell &&
        value_type === "list_strings" && {
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
 * 4. Returns table-ready data structures for @tanstack/react-table
 *
 * Row filtering is NOT applied here. The full unfiltered dataset is returned
 * so that ReactTable can compute stable column statistics (for magnitude bars)
 * from the complete data. Filtering is handled by ReactTable's `rowFilter` prop.
 */
export default function useAlignedData({
  index_type_name,
  slices,
  viewOnlySlices = undefined,
  getColumnDisplayOptions = undefined,
}: Parameters): AlignedData {
  const [state, setState] = useState<AlignedData>({
    columns: [],
    data: [],
    loading: false,
    error: null,
    entityLabel: "",
    exportToCsv: () => "",
  });

  // Use refs to store metadata that triggers the data fetch effect
  const indexTypeRef = useRef<DimensionType | null>(null);
  const idColumnDisplayNameRef = useRef<string>("");

  // Create CSV export callback that has access to current state.
  // Accepts an optional rowFilter to export only visible rows, or
  // exports all rows when no filter is provided.
  const exportToCsv = useCallback(
    (
      options: {
        rowFilter?: (
          row: Record<string, string | number | undefined>
        ) => boolean;
        sortedRowIds?: string[];
        visibleColumnIds?: string[];
        selectedRowIds?: Set<string>;
      } = {}
    ) => {
      const {
        rowFilter,
        sortedRowIds,
        visibleColumnIds,
        selectedRowIds,
      } = options;

      if (!state.columns.length || !state.data.length) {
        return "";
      }

      // Filter columns to only visible ones if specified
      const visibleColumnIdSet = visibleColumnIds
        ? new Set(visibleColumnIds)
        : null;
      const columnsToExport = visibleColumnIdSet
        ? state.columns.filter((col) => visibleColumnIdSet.has(col.id))
        : state.columns;

      // Apply the row filter if provided
      const filteredData = rowFilter
        ? state.data.filter(rowFilter)
        : state.data;

      // Sort to match display order if sortedRowIds is provided
      let dataToExport = filteredData;
      if (sortedRowIds && sortedRowIds.length > 0) {
        const orderMap = new Map(sortedRowIds.map((id, index) => [id, index]));

        dataToExport = [...filteredData].sort((a, b) => {
          const aOrder = orderMap.get(a.id as string) ?? Infinity;
          const bOrder = orderMap.get(b.id as string) ?? Infinity;
          return aOrder - bOrder;
        });
      }

      // Determine if we should include the selection column
      const shouldIncludeSelectionColumn =
        selectedRowIds && selectedRowIds.size > 0;

      // Create headers from column definitions
      const headers = columnsToExport.map((column) => column.meta.csvHeader);

      // Insert selection column header after ID (second position) if needed
      if (shouldIncludeSelectionColumn) {
        headers.splice(1, 0, "Selected");
      }

      // Transform data to match column order and convert values to strings
      const csvData = dataToExport.map((row) => {
        const rowData = columnsToExport.map((column) => {
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
    },
    [state.columns, state.data]
  );

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
          createDataFetchPromise(slice)
        );

        const datasetsPromise = cached(breadboxAPI).getDatasets();

        // Execute all fetches in parallel
        const [dataResponses, datasets] = await Promise.all([
          Promise.all(dataPromises),
          datasetsPromise,
        ]);

        if (isCancelled) return;

        // Resolve display labels for each slice
        const displayLabels = await Promise.all(
          slicesToFetch.map((slice) => resolveDisplayLabel(slice, indexType))
        );

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
              ? dataset.columns_metadata[slice.identifier]?.references
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
          displayLabels,
          slicesToFetch,
          viewOnlySlices,
          datasets as Dataset[],
          indexType,
          idColumnDisplayName,
          labelColumnDisplayName,
          idToLabelMappings,
          getColumnDisplayOptions
        );

        setState((prev) => ({
          ...prev,
          data,
          columns,
          entityLabel: indexType.display_name || indexType.name,
          loading: false,
          error: null,
        }));
      } catch (error) {
        window.console.error(error);

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
  }, [getColumnDisplayOptions, index_type_name, slices, viewOnlySlices]);

  return {
    columns: state.columns,
    data: state.data,
    loading: state.loading,
    error: state.error,
    entityLabel: state.entityLabel,
    exportToCsv,
  };
}
