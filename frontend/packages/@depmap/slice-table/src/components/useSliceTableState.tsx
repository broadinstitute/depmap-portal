import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { getConfirmation } from "@depmap/common-components";
import { RowSelectionState } from "@depmap/react-table";
import {
  areSliceQueriesEqual,
  isValidSliceQuery,
  SliceQuery,
} from "@depmap/types";
import useData, { createUniqueColumnKey, RowFilters } from "./useData";
import chooseDataSlice from "./chooseDataSlice";
import chooseFilters from "./chooseFilters";
import showDataSlicePreview from "./showDataSlicePreview";

export interface CellCtx {
  row: Record<"id", string> & { original: Record<string, unknown> };
  table: {
    getAllColumns: () => {
      columnDef: {
        id?: string;
        meta?: { sliceQuery?: SliceQuery };
      };
    }[];
  };
  column: unknown;
  getValue(): unknown;
}

interface Props {
  index_type_name: string;
  // Taken from SliceTable rather than read from context, for the same reason
  // SliceTable takes it as a prop: this hook runs in SliceTable itself, which
  // renders PlotlyLoaderProvider *below* itself, so a context read here
  // resolves against whatever ancestor happens to exist. In the app that is the
  // root provider and it works by luck; in a promptForValue modal, whose tree is
  // detached, there is no ancestor and it throws. The modals this hook opens
  // (chooseDataSlice, showDataSlicePreview) are detached too and need the value
  // passed down explicitly regardless.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PlotlyLoader: any;
  initialSlices: SliceQuery[];
  viewOnlySlices: Set<SliceQuery>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enableRowSelection: boolean | ((row: any) => boolean);
  initialRowSelection: RowSelectionState;
  onChangeSlices: (nextSlices: SliceQuery[]) => void;
  downloadFilename: string;
  tableRef: React.RefObject<{
    filterToSearchResults: boolean;
    setFilterToSearchResults: (enabled: boolean) => void;
    getDisplayRowIds: () => string[];
    getVisibleColumnIds: () => string[];
  }>;
  implicitFilter?: (row: {
    id: string;
    label: string;
    getValue: (sliceQuery: SliceQuery) => unknown;
  }) => boolean;
  customColumns?: CustomColumn[];
  customColumnPlacement?: CustomColumnPlacement;
  getColumnDisplayOptions?: (
    sliceQuery: SliceQuery
  ) => import("./useData").ColumnDisplayOptions | null;
  hiddenDatasets?: Set<string>;
}

// A column the caller supplies itself, for values that aren't Breadbox slices —
// links, buttons, or statistics computed by the caller.
//
// `cell` renders it. `accessorFn` is what makes it a first-class column rather
// than decoration: sorting, search and CSV export in @depmap/react-table are all
// driven by the accessor, not by the rendered node. Supply it whenever the
// column represents a *value* someone might want to sort or search by; leave it
// off for a column that only renders controls.
export interface CustomColumn {
  // Stable identifier, so a caller can refer to this column later — to open
  // the table sorted by it, for instance. Without one the id is positional
  // (`custom-0`, `custom-1`), which nobody outside this file should have to
  // know or depend on.
  id?: string;
  header: () => React.ReactNode;
  cell: (
    ctx: CellCtx,
    getValue: (sliceQuery: SliceQuery) => unknown
  ) => React.ReactNode;
  // Raw value behind the rendered cell. Its absence is what disables sorting,
  // so a column with no meaningful ordering simply omits it.
  accessorFn?: (row: Record<string, unknown>) => unknown;
  // Column heading used in the CSV download. Defaults to nothing, which keeps
  // the column out of the export entirely.
  csvHeader?: string;
  width?: number;
}

// Where the caller's own columns sit relative to the slice columns. "end" is
// the default because it is what every consumer got before the option existed.
export type CustomColumnPlacement = "end" | "beforeSliceColumns";

// Interleaves the caller's columns with the slice columns.
//
// `leadingCount` is the number of fixed columns at the front (id and label).
// "beforeSliceColumns" goes after those, never at the very front: react-table
// treats the first data column as sticky and excludes it from width
// redistribution, so a custom column landing there would be frozen in place and
// mis-sized. Keeping id/label leading means every positional assumption
// downstream still points at the column it did before.
// Two type parameters, not one: slice columns and custom columns genuinely have
// different shapes (only slice columns carry a header menu), and react-table is
// happy with the union. Sharing one parameter would silently infer it from
// whichever array came first.
export function mergeCustomColumns<S, C>(
  sliceColumns: S[],
  customColumns: C[],
  leadingCount: number,
  placement: CustomColumnPlacement
): (S | C)[] {
  if (placement === "beforeSliceColumns") {
    return [
      ...sliceColumns.slice(0, leadingCount),
      ...customColumns,
      ...sliceColumns.slice(leadingCount),
    ];
  }

  return [...sliceColumns, ...customColumns];
}

const defaultRowFilters = {
  hideUnselectedRows: false,
  hideIncompleteRows: false,
  hideRowsWithNoSearchResults: false,
};

export const filterPredicate = (
  // Structural minimum — anything with `id` and `meta.sliceQuery` works.
  // This accepts both the raw columns from `useData` and `extendedColumns`,
  // and decouples the helper from `useSliceTableState`'s own return type
  // (which would otherwise be self-referential).
  columns: ReadonlyArray<{ id: string; meta: { sliceQuery: SliceQuery } }>,
  implicitFilter: Props["implicitFilter"],
  sliceDataCache?: Map<string, Map<string, unknown>>
) => {
  if (!implicitFilter) {
    return () => true;
  }

  return (row: Record<string, string | string[] | number | undefined>) => {
    const id = row.id as string;
    const label = row.label as string;

    return implicitFilter({
      id,
      label,
      // Resolves against loaded columns and nothing else. There is deliberately
      // no fetch here — the predicate is synchronous and runs per row — so a
      // slice the table was never asked to display has no value to return. See
      // `implicitFilter`'s own comment in SliceTable.tsx for what to do instead;
      // buildSlicesToFetch in useData.tsx is where the fetched set is decided,
      // and it reads `slices`, never this.
      getValue: (sq: SliceQuery) => {
        const column = columns.find((c) => {
          const colSq = c.meta.sliceQuery;
          return isValidSliceQuery(colSq) && areSliceQueriesEqual(sq, colSq);
        });

        if (column) {
          return row[column.id];
        }

        // Fallback: look up cached data from columns that have been removed.
        if (sliceDataCache) {
          const cacheKey = createUniqueColumnKey(sq);
          return sliceDataCache.get(cacheKey)?.get(id);
        }

        return undefined;
      },
    });
  };
};

export function useSliceTableState({
  index_type_name,
  PlotlyLoader,
  initialSlices,
  viewOnlySlices,
  enableRowSelection,
  initialRowSelection,
  onChangeSlices,
  downloadFilename,
  tableRef,
  implicitFilter = undefined,
  customColumns = undefined,
  customColumnPlacement = "end",
  getColumnDisplayOptions = undefined,
  hiddenDatasets = undefined,
}: Props) {
  const [slices, setSlices] = useState<SliceQuery[]>(initialSlices || []);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(
    initialRowSelection || {}
  );

  // Adjusted during render rather than in an effect, deliberately. As an
  // effect, there was one committed render where `initialRowSelection` already
  // held the new seed and `rowSelection` was still the old (usually empty) one
  // — and SliceTable's "did the selection change?" effect ran on exactly that
  // pair, saw a difference, and reported the *stale* selection to the consumer.
  // The correct value arrived a render later but the callback had already
  // fired, so a table seeded asynchronously (stats arrive, then
  // forceInitialize) showed its rows checked while telling its owner nothing
  // was selected.
  //
  // React re-renders immediately on a set-during-render, before committing, so
  // no effect ever observes the mismatched pair. This is the documented pattern
  // for adjusting state when a prop changes.
  const [syncedInitialSelection, setSyncedInitialSelection] = useState(
    initialRowSelection
  );

  if (syncedInitialSelection !== initialRowSelection) {
    setSyncedInitialSelection(initialRowSelection);
    setRowSelection(initialRowSelection);
  }

  const prevIndexTypeName = useRef(index_type_name);

  useEffect(() => {
    // It is not typical for `index_type_name` to change.
    // But when it does, it means all our slices are invalid.
    if (index_type_name !== prevIndexTypeName.current) {
      setSlices([]);
    }

    prevIndexTypeName.current = index_type_name;
  }, [index_type_name]);

  // Cache column data so that implicitFilter's getValue callback can still
  // resolve values for columns the user has removed. The cache is keyed by
  // the same unique column key that useData uses, and each entry maps
  // row IDs to cell values. Because this effect runs every time `columns`
  // or `data` change, the cache is always populated *before* a removal
  // causes useData to drop the column.
  const sliceDataCacheRef = useRef<Map<string, Map<string, unknown>>>(
    new Map()
  );

  // Convert rowSelection to selectedRowIds
  const selectedRowIds = useMemo(() => {
    return new Set(
      Object.entries(rowSelection)
        .filter(([, isSelected]) => isSelected)
        .map(([rowId]) => rowId)
    );
  }, [rowSelection]);

  // TODO: Also implement column-based filters
  const [rowFilters, setRowFilters] = useState<RowFilters>(defaultRowFilters);

  useEffect(() => {
    tableRef.current?.setFilterToSearchResults(
      rowFilters.hideRowsWithNoSearchResults
    );
  }, [rowFilters, tableRef]);

  useEffect(() => {
    if (slices !== initialSlices) {
      onChangeSlices(slices);
    }
  }, [initialSlices, slices, onChangeSlices]);

  // Fetch data without any filtering — useData now returns the full dataset
  const { columns, data, loading, error, exportToCsv } = useData({
    getColumnDisplayOptions,
    index_type_name,
    slices,
    viewOnlySlices,
  });

  // Populate the slice data cache whenever columns or data change.
  useEffect(() => {
    const cache = sliceDataCacheRef.current;

    for (const col of columns) {
      if (!isValidSliceQuery(col.meta.sliceQuery)) {
        continue;
      }

      const cacheKey = createUniqueColumnKey(col.meta.sliceQuery);
      const colValues = cache.get(cacheKey) || new Map<string, unknown>();

      for (const row of data) {
        const val = row[col.id];

        if (val !== undefined) {
          colValues.set(row.id as string, val);
        }
      }

      cache.set(cacheKey, colValues);
    }
  }, [columns, data]);

  // Build a row filter predicate that combines hide-unselected and
  // hide-incomplete. This is passed to ReactTable's `rowFilter` prop so
  // that column stats (magnitude bars) are computed from the full dataset
  // while only matching rows are displayed.
  //
  // `hideRowsWithNoSearchResults` is NOT included here — it's handled by
  // ReactTable's own `filterToSearchResults` mechanism because ReactTable
  // owns the search state needed to evaluate it.
  const rowFilter = useMemo(() => {
    const { hideUnselectedRows, hideIncompleteRows } = rowFilters;

    // If no filters are active, return undefined so ReactTable skips filtering
    if (!hideUnselectedRows && !hideIncompleteRows) {
      return undefined;
    }

    return (row: Record<string, string | number | undefined>) => {
      if (hideUnselectedRows) {
        const rowId = row.id as string;
        if (!selectedRowIds.has(rowId)) {
          return false;
        }
      }

      if (hideIncompleteRows) {
        const hasUndefinedValues = Object.entries(row).some(([key, value]) => {
          // Skip id and label columns for completeness check
          if (key === "id" || key === "label") {
            return false;
          }

          return (
            value === undefined || (Array.isArray(value) && value.length === 0)
          );
        });

        if (hasUndefinedValues) {
          return false;
        }
      }

      return true;
    };
  }, [rowFilters, selectedRowIds]);

  const idColumnLabel = columns[0]?.meta.idLabel;
  let shouldShowLabelColumn = true;

  if (
    columns &&
    columns.length >= 2 &&
    idColumnLabel === columns[1].meta.idLabel
  ) {
    shouldShowLabelColumn = false;
  }

  const buildExtraHoverData = useCallback(
    (excludeColumnId: string): Record<string, string> => {
      const otherCols = columns.filter(
        (c) => c.id !== excludeColumnId && c.id !== "label"
      );

      const result: Record<string, string> = {};

      if (otherCols.length > 0) {
        for (const row of data) {
          const id = row.id as string;
          let lines: string[] = [];

          for (const c of otherCols) {
            const val = row[c.id];
            if (val != null) {
              const label =
                typeof c.header === "string"
                  ? c.header
                  : c.meta?.idLabel ?? c.id;
              lines.push(`${label}: ${val}`);
            }
          }

          const MAX_EXTRA_HOVER_DATA_LINES = 26;
          lines = lines.slice(0, MAX_EXTRA_HOVER_DATA_LINES);

          if (lines.length > 0) {
            result[id] = lines.join("<br>");
          }
        }
      }

      return result;
    },
    [columns, data]
  );

  // Build the set of row IDs that pass the implicit filter (i.e. the rows
  // that would be visible if the user had no filters applied). When there
  // is no implicit filter, returns undefined — SlicePreview will fall back
  // to using the full preview dataset as the baseline. This is passed
  // alongside `visibleRowIds` so the preview can distinguish between
  // "filtering caused by the (invisible) implicit filter" and "filtering
  // the user actually applied themselves".
  const getUnfilteredRowIds = useCallback((): Set<string> | undefined => {
    if (!implicitFilter) {
      return undefined;
    }

    const predicate = filterPredicate(
      columns,
      implicitFilter,
      sliceDataCacheRef.current
    );

    return new Set(data.filter(predicate).map((row) => row.id as string));
  }, [columns, data, implicitFilter]);

  const handleClickAddColumn = useCallback(async () => {
    const visibleRowIds = new Set(tableRef.current?.getDisplayRowIds() || []);
    const unfilteredRowIds = getUnfilteredRowIds();

    const newSlice = await chooseDataSlice({
      index_type_name,
      PlotlyLoader,
      existingSlices: slices,
      idColumnLabel,
      hiddenDatasets,
      extraHoverData: buildExtraHoverData(""),
      visibleRowIds,
      unfilteredRowIds,
    });

    if (newSlice) {
      setSlices((prev) => {
        if (prev.find((oldSlice) => areSliceQueriesEqual(oldSlice, newSlice))) {
          return prev;
        }

        return [...prev, newSlice];
      });
    }
  }, [
    hiddenDatasets,
    idColumnLabel,
    index_type_name,
    PlotlyLoader,
    slices,
    buildExtraHoverData,
    tableRef,
    getUnfilteredRowIds,
  ]);

  const handleClickEditColumn = useCallback(
    async (column: typeof columns[number]) => {
      const defaultValue = column.meta.sliceQuery;

      const datasets = await cached(breadboxAPI).getDatasets();
      const dataset = datasets.find(
        (d) =>
          d.id === defaultValue.dataset_id ||
          d.given_id === defaultValue.dataset_id
      );
      const initialSource = ["Annotations", "metadata"].includes(
        dataset?.data_type || ""
      )
        ? "property"
        : "custom";

      const visibleRowIds = new Set(tableRef.current?.getDisplayRowIds() || []);
      const unfilteredRowIds = getUnfilteredRowIds();

      const editedSlice = await chooseDataSlice({
        defaultValue,
        initialSource,
        index_type_name,
        PlotlyLoader,
        existingSlices: slices,
        idColumnLabel,
        hiddenDatasets,
        extraHoverData: buildExtraHoverData(column.id),
        visibleRowIds,
        unfilteredRowIds,
      });

      if (editedSlice) {
        setSlices((prev) =>
          prev.map((slice) =>
            slice === column.meta.sliceQuery ? editedSlice : slice
          )
        );
      }
    },
    [
      hiddenDatasets,
      idColumnLabel,
      index_type_name,
      PlotlyLoader,
      slices,
      buildExtraHoverData,
      tableRef,
      getUnfilteredRowIds,
    ]
  );

  const handleClickViewColumn = useCallback(
    async (column: typeof columns[number]) => {
      const visibleRowIds = new Set(tableRef.current?.getDisplayRowIds() || []);
      const unfilteredRowIds = getUnfilteredRowIds();

      showDataSlicePreview({
        index_type_name,
        PlotlyLoader,
        sliceQuery: column.meta.sliceQuery,
        extraHoverData: buildExtraHoverData(column.id),
        visibleRowIds,
        unfilteredRowIds,
      });
    },
    [
      index_type_name,
      PlotlyLoader,
      buildExtraHoverData,
      tableRef,
      getUnfilteredRowIds,
    ]
  );

  const removeColumn = useCallback(
    (column: { meta: { sliceQuery: SliceQuery } }) => {
      setSlices((prev) =>
        prev.filter(
          (slice) => !areSliceQueriesEqual(slice, column.meta.sliceQuery)
        )
      );
    },
    []
  );

  const extendedColumns = useMemo(() => {
    const OFFSET = columns.length - slices.length;

    const sliceColumns = columns.map((column, colIndex) => ({
      ...column,
      // A column whose dataset was removed can never load again, so the fix
      // goes right where the failure is shown, not only in the header menu.
      // A transient failure deliberately does NOT get this: its column would
      // come back on reload, and an inline remove would train users to
      // delete it.
      ...(column.meta.loadFailure === "dataset_removed" &&
        column.meta.isEditable && {
          header: () => (
            <div>
              {column.header()}
              <button
                type="button"
                className="btn btn-default btn-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  removeColumn(column);
                }}
              >
                Remove column
              </button>
            </div>
          ),
        }),
      meta: {
        ...column.meta,
        headerMenuItems: [
          !column.meta.loadFailure &&
            column.meta.isEditable && {
              label: "View distribution",
              icon: "glyphicon-eye-open",
              onClick: () => handleClickEditColumn(column),
            },

          !column.meta.loadFailure &&
            !column.meta.isEditable &&
            column.meta.isViewable && {
              label: "View distribution",
              icon: "glyphicon-eye-open",
              onClick: () => handleClickViewColumn(column),
            },

          colIndex >= OFFSET && {
            label: "Move column left",
            icon: "glyphicon-arrow-left",
            disabled: colIndex <= OFFSET,
            onClick: () => {
              setSlices((prev) => {
                const index = colIndex - OFFSET;

                const newSlices = [...prev];
                [newSlices[index - 1], newSlices[index]] = [
                  newSlices[index],
                  newSlices[index - 1],
                ];

                return newSlices;
              });
            },
          },

          colIndex >= OFFSET && {
            label: "Move column right",
            icon: "glyphicon-arrow-right",
            disabled: colIndex < OFFSET || colIndex >= columns.length - 1,
            onClick: () => {
              setSlices((prev) => {
                const index = colIndex - OFFSET;

                const newSlices = [...prev];
                [newSlices[index], newSlices[index + 1]] = [
                  newSlices[index + 1],
                  newSlices[index],
                ];

                return newSlices;
              });
            },
          },

          column.meta.isEditable && {
            widget: "divider",
          },

          column.meta.isEditable && {
            label: "Remove column",
            icon: "glyphicon-remove-sign",
            onClick: async () => {
              // The confirmation exists to protect a working column. A
              // column whose dataset no longer exists has nothing to lose,
              // and its header already explains why it's being removed.
              if (column.meta.loadFailure === "dataset_removed") {
                removeColumn(column);
                return;
              }

              const confirmed = await getConfirmation({
                message: (
                  <div>
                    Are you sure you want to remove the column{" "}
                    <b>“{column.meta.idLabel}”</b>?
                  </div>
                ),
                yesText: "Remove",
                noText: "Cancel",
              });

              if (confirmed) {
                setTimeout(() => removeColumn(column));
              }
            },
          },
        ].filter(Boolean),
      },
    }));

    const nonSliceColumns = (customColumns || []).map((col, i) => ({
      header: col.header,
      cell: (cellCtx: CellCtx) => {
        const id = cellCtx.row.id;

        return col.cell(cellCtx, (sliceQuery: SliceQuery) => {
          if (sliceDataCacheRef.current) {
            const cacheKey = createUniqueColumnKey(sliceQuery);
            return sliceDataCacheRef.current.get(cacheKey)?.get(id);
          }

          return undefined;
        });
      },
      id: col.id ?? `custom-${i}`,
      // Falls back to the old behavior when the caller supplies no accessor:
      // a null value, which react-table's search skips and which sorts nothing.
      // `enableSorting` is derived rather than configurable because sorting by
      // a column whose every value is null is never what anyone wants.
      accessorFn: col.accessorFn ?? (() => null),
      enableSorting: col.accessorFn != null,
      ...(col.width != null && { size: col.width }),
      meta: {
        idLabel: "",
        units: "",
        value_type: null,
        datasetName: "",
        csvHeader: col.csvHeader ?? "",
        sliceQuery: {} as SliceQuery,
        isEditable: false,
        isViewable: false,
      },
    }));

    return mergeCustomColumns(
      sliceColumns,
      nonSliceColumns,
      OFFSET,
      customColumnPlacement
    );
  }, [
    columns,
    customColumns,
    customColumnPlacement,
    handleClickEditColumn,
    handleClickViewColumn,
    removeColumn,
    slices.length,
  ]);

  const handleClickFilterButton = useCallback(async () => {
    // The filter dialog only asks whether selection exists at all, not which
    // rows can use it.
    const result = await chooseFilters({
      enableRowSelection: Boolean(enableRowSelection),
      rowFilters,
    });

    if (result) {
      setRowFilters(result);
    }
  }, [enableRowSelection, rowFilters]);

  const handleClickDownload = useCallback(() => {
    // TODO: Add a UI toggle to let the user choose between exporting
    // filtered rows or the complete dataset. For now, always export
    // the filtered view to match what's visible on screen.
    //
    // getDisplayRowIds() returns the row IDs currently visible in
    // ReactTable after ALL filters are applied (rowFilter +
    // filterToSearchResults). We combine this with the implicitFilter
    // to produce a single rowFilter for export that matches exactly
    // what the user sees.
    const displayRowIds = tableRef.current?.getDisplayRowIds();
    const visibleColumnIds = tableRef.current?.getVisibleColumnIds();
    // Build a Set for efficient lookup in the filter predicate
    const displayRowIdSet = displayRowIds ? new Set(displayRowIds) : null;

    const csvString = exportToCsv({
      rowFilter: (row) => {
        // Apply implicit filter (scopes the dataset itself)
        if (
          implicitFilter &&
          !filterPredicate(
            extendedColumns,
            implicitFilter,
            sliceDataCacheRef.current
          )(row)
        ) {
          return false;
        }

        // Apply ReactTable's visible row set (user-visible filters + search)
        if (displayRowIds && !displayRowIdSet?.has(row.id as string)) {
          return false;
        }

        return true;
      },
      // Pass ordered IDs so export matches the current sort order
      sortedRowIds: displayRowIds ?? undefined,
      visibleColumnIds: visibleColumnIds ?? undefined,
      selectedRowIds,
      // The merged, correctly-ordered list, so the download matches what is on
      // screen. Custom columns without a `csvHeader` drop out on the far side,
      // which is what keeps existing consumers' exports unchanged.
      columns: extendedColumns,
    });

    // Download as file
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const href = URL.createObjectURL(blob);

    let dlAttr = downloadFilename || `${index_type_name} table`;
    if (!dlAttr.endsWith(".csv")) {
      dlAttr += ".csv";
    }

    const link = document.createElement("a");
    link.setAttribute("href", href);
    link.setAttribute("download", dlAttr);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [
    extendedColumns,
    index_type_name,
    downloadFilename,
    exportToCsv,
    implicitFilter,
    tableRef,
    selectedRowIds,
  ]);

  return {
    data,
    error,
    loading,
    columns: extendedColumns,
    rowFilter,
    handleClickAddColumn,
    handleClickDownload,
    handleClickFilterButton,
    rowSelection,
    setRowSelection,
    shouldShowLabelColumn,
    numFiltersApplied: Object.values(rowFilters).filter(Boolean).length,
    sliceDataCacheRef,
  };
}
