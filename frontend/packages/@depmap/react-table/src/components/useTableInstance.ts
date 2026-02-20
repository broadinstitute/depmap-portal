import React, {
  useCallback,
  useState,
  useRef,
  useMemo,
  useEffect,
} from "react";
import {
  ColumnDef,
  RowData,
  SortingState,
  RowSelectionState,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

type SelectionOptions<TData> = {
  enableRowSelection?: boolean;
  enableMultiRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (
    updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)
  ) => void;
  getRowId?: (row: TData) => string;
  enableStickyFirstColumn?: boolean;
  defaultSort?: (a: TData, b: TData) => number;
  columnVisibility?: Record<string, boolean>;
  onColumnVisibilityChange?: (
    updater:
      | Record<string, boolean>
      | ((old: Record<string, boolean>) => Record<string, boolean>)
  ) => void;
  enableSearch?: boolean;
  rowFilter?: (row: TData) => boolean;
};

type SearchMatchInfo = {
  rowIndex: number;
  rowId: string;
  columnId: string;
};

export type ColumnStats = {
  min: number;
  max: number;
  hasVariance: boolean;
};

export function useTableInstance<TData extends RowData>(
  columns: ColumnDef<TData, unknown>[],
  data: TData[],
  selectionOptions: SelectionOptions<TData> = {}
) {
  const {
    enableRowSelection = false,
    enableMultiRowSelection = true,
    rowSelection: controlledRowSelection,
    onRowSelectionChange,
    getRowId,
    enableStickyFirstColumn = false,
    defaultSort = undefined,
    columnVisibility: controlledColumnVisibility,
    onColumnVisibilityChange,
    enableSearch = false,
    rowFilter = undefined,
  } = selectionOptions;

  const [sorting, setSorting] = useState<SortingState>([]);
  const [
    internalRowSelection,
    setInternalRowSelection,
  ] = useState<RowSelectionState>({});
  const [internalColumnVisibility, setInternalColumnVisibility] = useState<
    Record<string, boolean>
  >({});
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track manually resized columns, previous column count, and column sizing state
  const [manuallyResizedColumns, setManuallyResizedColumns] = useState<
    Set<string>
  >(new Set());
  const previousColumnCount = useRef<number>(0);
  const [columnSizing, setColumnSizing] = useState<Record<string, number>>({});

  // ResizeObserver ref to track container width changes
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const displayRowsRef = useRef<any[]>([]);

  // Refs for synchronized scrolling
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  // Search state - stored in refs to avoid re-renders on currentMatchIndex changes
  const searchQueryRef = useRef<string>("");
  const currentMatchIndexRef = useRef<number>(0);
  const totalMatchesRef = useRef<number>(0);
  const filterToSearchResultsRef = useRef<boolean>(false);
  const searchListenersRef = useRef<Set<() => void>>(new Set());

  // This state triggers re-renders when search query or filter mode changes
  const [searchQueryTrigger, setSearchQueryTrigger] = useState(0);

  const notifySearchListeners = useCallback(() => {
    searchListenersRef.current.forEach((listener) => listener());
  }, []);

  const setSearchQuery = useCallback(
    (query: string) => {
      searchQueryRef.current = query;
      currentMatchIndexRef.current = 0;
      setSearchQueryTrigger((n) => n + 1); // Trigger re-render for new search
      notifySearchListeners();
    },
    [notifySearchListeners]
  );

  const [currentMatchTrigger, setCurrentMatchTrigger] = useState(0);

  const setCurrentMatchIndex = useCallback(
    (index: number) => {
      currentMatchIndexRef.current = index;
      setCurrentMatchTrigger((n) => n + 1);
      notifySearchListeners(); // Notify listeners but don't re-render table
    },
    [notifySearchListeners]
  );

  const setFilterToSearchResults = useCallback(
    (enabled: boolean) => {
      filterToSearchResultsRef.current = enabled;
      currentMatchIndexRef.current = 0;
      setSearchQueryTrigger((n) => n + 1); // Trigger re-render to apply filter
      notifySearchListeners();
    },
    [notifySearchListeners]
  );

  const subscribeToSearch = useCallback((listener: () => void) => {
    searchListenersRef.current.add(listener);
    return () => {
      searchListenersRef.current.delete(listener);
    };
  }, []);

  // Use controlled selection if provided, otherwise use internal state
  const rowSelection = controlledRowSelection ?? internalRowSelection;
  const handleRowSelectionChange =
    onRowSelectionChange ?? setInternalRowSelection;

  // Use controlled column visibility if provided, otherwise use internal state
  const columnVisibility =
    controlledColumnVisibility ?? internalColumnVisibility;
  const handleColumnVisibilityChange =
    onColumnVisibilityChange ?? setInternalColumnVisibility;

  // Read search query from ref (changes trigger re-render via searchQueryTrigger)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _searchQueryTrigger = searchQueryTrigger; // Reference to ensure re-render
  const searchQuery = searchQueryRef.current;

  // Function to synchronize header scroll with body scroll
  const syncScroll = useCallback((scrollLeft: number) => {
    const el = headerScrollRef.current;
    if (el) {
      const max = el.scrollWidth - el.clientWidth;
      el.scrollLeft = Math.min(scrollLeft, max);
    }
  }, []);

  // Reverse sync: header → body (for trackpad gestures over the header)
  const syncHeaderToBody = useCallback((scrollLeft: number) => {
    const el = parentRef.current;
    if (el) {
      const max = el.scrollWidth - el.clientWidth;
      el.scrollLeft = Math.min(scrollLeft, max);
    }
  }, []);

  // Helper function to safely get column ID
  const getColumnId = useCallback((col: ColumnDef<TData, unknown>): string => {
    if (col.id) return col.id;
    if ("accessorKey" in col && col.accessorKey) {
      return col.accessorKey.toString();
    }
    return Math.random().toString(36).substr(2, 9); // fallback random ID
  }, []);

  // Create columns with selection column if needed (no auto-sizing here)
  const enhancedColumns = useMemo(() => {
    const baseColumns = enableRowSelection
      ? [
          {
            id: "select",
            header: ({ table }: { table: any }) => {
              if (!enableMultiRowSelection) {
                return null;
              }

              // Use displayRowsRef to scope select-all to visible rows only.
              // This ensures that when filters are active, the toggle only
              // affects the rows the user can actually see.
              const visibleRows = displayRowsRef.current;
              const selectionState = table.getState().rowSelection;

              const allVisibleSelected =
                visibleRows.length > 0 &&
                visibleRows.every((row: any) => selectionState[row.id]);
              const someVisibleSelected =
                !allVisibleSelected &&
                visibleRows.some((row: any) => selectionState[row.id]);

              return React.createElement("input", {
                type: "checkbox",
                checked: allVisibleSelected,
                ref: (input: HTMLInputElement | null) => {
                  if (input) {
                    // eslint-disable-next-line no-param-reassign
                    input.indeterminate = someVisibleSelected;
                  }
                },
                onChange: () => {
                  // Toggle: if all visible are selected, deselect them;
                  // otherwise select all visible. Preserve selection state
                  // of non-visible rows.
                  const nextSelection = { ...selectionState };

                  if (allVisibleSelected) {
                    visibleRows.forEach((row: any) => {
                      delete nextSelection[row.id];
                    });
                  } else {
                    visibleRows.forEach((row: any) => {
                      nextSelection[row.id] = true;
                    });
                  }

                  handleRowSelectionChange(nextSelection);
                },
              });
            },
            cell: ({ row }: { row: any }) => {
              return React.createElement("input", {
                type: enableMultiRowSelection ? "checkbox" : "radio",
                name: enableMultiRowSelection ? undefined : "row-selection",
                checked: row.getIsSelected(),
                disabled: !row.getCanSelect(),
                onChange: row.getToggleSelectedHandler(),
                onClick: (e: React.MouseEvent) => e.stopPropagation(),
              });
            },
            size: 38,
            minSize: 38,
            maxSize: 38,
            enableSorting: false,
            enableResizing: false,
          },
          ...columns,
        ]
      : columns;

    // Ensure all columns have a default size if not specified
    const withDefaults = baseColumns.map((col) => {
      if (col.size !== undefined) {
        return col;
      }
      return {
        ...col,
        size: 150, // default size
      };
    });

    // Enforce a minSize on the last column so its right-edge resizer
    // is easier to grab (it won't collapse to a sliver).
    if (withDefaults.length > 0) {
      const last = withDefaults[withDefaults.length - 1];
      const LAST_COL_MIN_SIZE = 150;

      if (!last.minSize || last.minSize < LAST_COL_MIN_SIZE) {
        withDefaults[withDefaults.length - 1] = {
          ...last,
          minSize: LAST_COL_MIN_SIZE,
        };
      }
    }

    return withDefaults;
  }, [
    columns,
    enableRowSelection,
    enableMultiRowSelection,
    handleRowSelectionChange,
  ]);

  // Apply custom default sort when no column sorts are active
  const sortedData = useMemo(() => {
    // If there are active column sorts, let TanStack Table handle it
    if (sorting.length > 0 || !defaultSort) {
      return data;
    }

    // Apply custom default sort
    return [...data].sort(defaultSort);
  }, [data, sorting, defaultSort]);

  // Compute column statistics for magnitude bars.
  // IMPORTANT: This is computed from the full `data` array, NOT from filtered
  // rows. This ensures magnitude bar ranges stay stable when user-visible
  // filters (hide unselected, hide incomplete, etc.) are toggled. Implicit
  // filters that shape the dataset itself should be applied before passing
  // `data` to ReactTable.
  const columnStats = useMemo(() => {
    const stats: Record<string, ColumnStats> = {};

    // Build a map of column accessors for efficient data extraction
    const columnAccessors: Array<{
      id: string;
      accessorFn?: (row: TData, index: number) => unknown;
      accessorKey?: string;
    }> = [];

    enhancedColumns.forEach((col) => {
      const colId = getColumnId(col);
      // Skip the select column
      if (colId === "select") return;

      const accessorFn = (col as any).accessorFn;
      const accessorKey = (col as any).accessorKey;

      if (accessorFn || accessorKey) {
        columnAccessors.push({ id: colId, accessorFn, accessorKey });
      }
    });

    // Initialize stats with extreme values
    columnAccessors.forEach(({ id }) => {
      stats[id] = {
        min: Infinity,
        max: -Infinity,
        hasVariance: false,
      };
    });

    // Single pass through data to compute all column stats
    data.forEach((row, rowIndex) => {
      columnAccessors.forEach(({ id, accessorFn, accessorKey }) => {
        let value: unknown;
        if (accessorFn) {
          value = accessorFn(row, rowIndex);
        } else if (accessorKey) {
          value = (row as any)[accessorKey];
        }

        // Only process numeric values
        if (typeof value === "number" && !Number.isNaN(value)) {
          const colStats = stats[id];
          if (value < colStats.min) colStats.min = value;
          if (value > colStats.max) colStats.max = value;
        }
      });
    });

    // Determine hasVariance and clean up columns with no numeric data
    Object.keys(stats).forEach((colId) => {
      const colStats = stats[colId];

      // If min is still Infinity, no numeric values were found
      if (colStats.min === Infinity) {
        delete stats[colId];
        return;
      }

      // Check for variance (min !== max)
      colStats.hasVariance = colStats.min !== colStats.max;
    });

    return stats;
  }, [data, enhancedColumns, getColumnId]);

  const table = useReactTable({
    data: sortedData,
    columns: enhancedColumns,
    state: {
      sorting,
      rowSelection,
      columnSizing,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: handleRowSelectionChange,
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onColumnSizingChange: (updater) => {
      if (typeof updater === "function") {
        const newSizing = updater(columnSizing);
        setColumnSizing(newSizing);

        // Track which columns have been manually resized
        for (const [columnId, newSize] of Object.entries(newSizing)) {
          if (columnSizing[columnId] !== newSize) {
            setManuallyResizedColumns((prev) => new Set([...prev, columnId]));
          }
        }
      } else {
        setColumnSizing(updater);
        // Track all columns in the sizing object as manually resized
        for (const columnId of Object.keys(updater)) {
          setManuallyResizedColumns((prev) => new Set([...prev, columnId]));
        }
      }
    },
    columnResizeMode: "onChange",
    columnResizeDirection: "ltr",
    enableColumnResizing: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection,
    enableMultiRowSelection,
    getRowId,
    defaultColumn: {
      sortUndefined: "last",
      size: 150,
      minSize: 100,
      maxSize: 1000,
    },
  });

  // Store table reference
  const tableRef = useRef(table);
  tableRef.current = table;

  // Get rows once per render cycle with a stable dependency proxy
  // Using table.getRowModel().rows directly in deps causes re-computation
  // because it returns a new array reference on each call
  const rows = table.getRowModel().rows;

  // Apply the external rowFilter to get the set of rows that are eligible
  // for display and search. This is memoized separately so both
  // searchMatches and displayRows can share the same filtered set without
  // redundant filtering.
  const filteredRows = useMemo(() => {
    if (!rowFilter) return rows;
    return rows.filter((row) => rowFilter(row.original));
  }, [rows, rowFilter]);

  // Helper to get searchable text from a cell value
  const getSearchableText = useCallback((value: unknown): string => {
    if (value == null) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value.map((v) => getSearchableText(v)).join(" ");
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  }, []);

  // Calculate search matches against filtered rows so search doesn't
  // navigate to rows that are hidden by the rowFilter.
  const searchMatches = useMemo<SearchMatchInfo[]>(() => {
    if (!enableSearch || !searchQuery || searchQuery.trim() === "") {
      return [];
    }

    const query = searchQuery.toLowerCase();
    const matches: SearchMatchInfo[] = [];

    // Get visible column IDs and their accessors for direct data access
    // This avoids the expensive row.getVisibleCells() call
    const visibleColumns = table
      .getVisibleLeafColumns()
      .filter((col) => col.id !== "select")
      .map((col) => ({
        id: col.id,
        accessorFn: col.accessorFn,
        accessorKey: (col.columnDef as any).accessorKey,
      }));

    filteredRows.forEach((row, rowIndex) => {
      const rowData = row.original;

      visibleColumns.forEach((col) => {
        // Get value directly from data instead of through TanStack's cell API
        let cellValue: unknown;
        if (col.accessorFn) {
          cellValue = col.accessorFn(rowData, rowIndex);
        } else if (col.accessorKey) {
          cellValue = (rowData as any)[col.accessorKey];
        } else {
          return; // No accessor, skip
        }

        const searchableText = getSearchableText(cellValue).toLowerCase();

        if (searchableText.includes(query)) {
          matches.push({
            rowIndex,
            rowId: row.id,
            columnId: col.id,
          });
        }
      });
    });

    return matches;
  }, [enableSearch, searchQuery, getSearchableText, filteredRows, table]);

  // Get the set of row IDs that have matches (for filtering)
  const matchingRowIds = useMemo(() => {
    const ids = new Set<string>();
    searchMatches.forEach((match) => ids.add(match.rowId));
    return ids;
  }, [searchMatches]);

  // Filter rows to only those with search matches (when filter is enabled).
  // Starts from filteredRows (already has rowFilter applied), then
  // optionally narrows further to only search-matching rows.
  const filterToSearchResults = filterToSearchResultsRef.current;
  const displayRows = useMemo(() => {
    if (!filterToSearchResults || !searchQuery || matchingRowIds.size === 0) {
      return filteredRows;
    }
    return filteredRows.filter((row) => matchingRowIds.has(row.id));
  }, [filteredRows, filterToSearchResults, searchQuery, matchingRowIds]);

  // Keep a ref to displayRows so the select-all checkbox (defined in
  // enhancedColumns, which can't depend on displayRows directly) can
  // read the current visible rows without a circular dependency.
  displayRowsRef.current = displayRows;

  // Update totalMatches ref and reset currentMatchIndex when matches change
  useEffect(() => {
    totalMatchesRef.current = searchMatches.length;

    if (
      searchMatches.length > 0 &&
      currentMatchIndexRef.current >= searchMatches.length
    ) {
      currentMatchIndexRef.current = 0;
    } else if (searchMatches.length === 0) {
      currentMatchIndexRef.current = 0;
    }

    notifySearchListeners();
  }, [searchMatches, notifySearchListeners]);

  // Memoized lookup map for row index by rowId (uses displayRows for correct indices)
  const rowIndexByIdMap = useMemo(() => {
    const map = new Map<string, number>();
    displayRows.forEach((row, index) => {
      map.set(row.id, index);
    });
    return map;
  }, [displayRows]);

  // Calculate sticky columns information
  const stickyColumnsInfo = useMemo(() => {
    const hasSelectColumn = enableRowSelection;
    const selectColumn = hasSelectColumn ? table.getColumn("select") : null;
    const selectColumnWidth = selectColumn ? selectColumn.getSize() : 0;

    // Get the first data column (after selection if present)
    const allColumns = table.getAllColumns();
    const firstDataColumn = hasSelectColumn ? allColumns[1] : allColumns[0];
    const firstColumnWidth = firstDataColumn ? firstDataColumn.getSize() : 0;

    return {
      selectColumnWidth,
      firstColumnWidth,
      hasSelectColumn,
      hasStickyFirstColumn: enableStickyFirstColumn,
    };
  }, [table, enableRowSelection, enableStickyFirstColumn]);

  // Rest of the existing logic remains the same...
  // [Previous auto-sizing and ResizeObserver logic continues unchanged]

  const redistributeAutoSizeableColumns = useCallback(
    (newContainerWidth: number) => {
      if (newContainerWidth <= 0 || !table) return;

      // Determine which column index is the sticky first data column
      // so we can exclude it from auto-sizing when sticky is enabled.
      const hasSelectColumn = enableRowSelection;
      let stickyFirstDataColIndex = -1;

      if (enableStickyFirstColumn) {
        stickyFirstDataColIndex = hasSelectColumn ? 1 : 0;
      }

      // Calculate available width for auto-sized columns
      let explicitSizesTotal = 0;
      let autoSizeColumnCount = 0;

      // Track total width consumed by sticky columns. Sticky columns are
      // pinned over the scrollable area, so the remaining (non-sticky)
      // columns must fit within containerWidth minus the sticky width.
      let stickyColumnsTotal = 0;

      enhancedColumns.forEach((col, colIndex) => {
        const colId = getColumnId(col);

        // Skip hidden columns
        const isVisible = table.getColumn(colId)?.getIsVisible() ?? true;
        if (!isVisible) return;

        const hasExplicitSize = col.size !== undefined && col.size !== 150; // 150 is our default
        const wasManuallyResized = manuallyResizedColumns.has(colId);

        // The select column always has an explicit size (38px)
        const isSelectColumn = colId === "select";

        // Check if this is the sticky first data column
        const isStickyFirstDataCol = colIndex === stickyFirstDataColIndex;

        if (isSelectColumn) {
          // Select column: always explicit, and sticky when present
          explicitSizesTotal += col.size!;
          stickyColumnsTotal += col.size!;
        } else if (isStickyFirstDataCol) {
          // Sticky first data column: treat as explicit (don't auto-size it)
          // and account for it in the sticky width budget.
          const currentSize =
            wasManuallyResized || hasExplicitSize
              ? table.getColumn(colId)?.getSize() || col.size || 150
              : col.size || 150;
          explicitSizesTotal += currentSize;
          stickyColumnsTotal += currentSize;
        } else if (hasExplicitSize) {
          explicitSizesTotal += col.size!;
        } else if (!wasManuallyResized) {
          // This column needs auto-sizing
          autoSizeColumnCount++;
        } else {
          // Manually resized - get current size from table
          const currentSize = table.getColumn(colId)?.getSize() || 150;
          explicitSizesTotal += currentSize;
        }
      });

      // When sticky columns are enabled, the non-sticky columns must fit
      // within the container width minus the sticky columns' total width,
      // because the sticky columns overlay the scrollable area. Without
      // this adjustment the auto-sized columns are too wide and overflow.
      const stickyReduction = enableStickyFirstColumn ? stickyColumnsTotal : 0;

      // Calculate equal width for auto-sized columns
      const availableWidth =
        newContainerWidth - explicitSizesTotal - stickyReduction;
      const autoColumnWidth =
        autoSizeColumnCount > 0
          ? Math.max(100, availableWidth / autoSizeColumnCount)
          : 150;

      // Set column sizes using TanStack Table's method
      const newSizing: Record<string, number> = {};

      enhancedColumns.forEach((col, colIndex) => {
        const colId = getColumnId(col);

        // Skip hidden columns
        const isVisible = table.getColumn(colId)?.getIsVisible() ?? true;
        if (!isVisible) return;

        const hasExplicitSize = col.size !== undefined && col.size !== 150;
        const wasManuallyResized = manuallyResizedColumns.has(colId);

        // Sticky first data column is excluded from auto-sizing
        const isStickyFirstDataCol = colIndex === stickyFirstDataColIndex;

        if (!hasExplicitSize && !wasManuallyResized && !isStickyFirstDataCol) {
          // Auto-size this column
          newSizing[colId] = autoColumnWidth;
        }
      });

      // Apply the new sizing if we have changes
      if (Object.keys(newSizing).length > 0) {
        setColumnSizing((prev) => ({ ...prev, ...newSizing }));
      }
    },
    [
      enhancedColumns,
      getColumnId,
      manuallyResizedColumns,
      table,
      enableStickyFirstColumn,
      enableRowSelection,
    ]
  );

  // Set up ResizeObserver to watch container width changes
  useEffect(() => {
    if (!containerRef.current) {
      return () => {};
    }

    // Initial width calculation
    const calculateInitialWidth = () => {
      if (!containerRef.current) return;

      // Walk up the DOM to find a stable width reference
      let element = containerRef.current.parentElement;
      let width = 0;

      // Try to find a parent with explicit width or use viewport as fallback
      while (element && !width) {
        const computedStyle = getComputedStyle(element);
        const elementWidth = element.clientWidth;

        // If this element has explicit width or is the body, use it
        if (
          computedStyle.width !== "auto" ||
          element.tagName === "BODY" ||
          !element.parentElement
        ) {
          width = elementWidth;
          break;
        }
        element = element.parentElement;
      }

      // Fallback to viewport width if we can't find anything
      if (!width) {
        width = window.innerWidth - 32; // Account for some padding
      }

      setContainerWidth(width);
    };

    // Set up ResizeObserver to watch for container size changes
    const setupResizeObserver = () => {
      if (typeof ResizeObserver === "undefined") {
        // Fallback for browsers without ResizeObserver support
        calculateInitialWidth();
        return;
      }

      resizeObserverRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const newWidth = entry.contentRect.width;
          if (newWidth > 0 && newWidth !== containerWidth) {
            setContainerWidth(newWidth);
          }
        }
      });

      // Find the parent element to observe
      let elementToObserve = containerRef.current?.parentElement;

      // Walk up to find a suitable parent container to observe
      while (elementToObserve) {
        const computedStyle = getComputedStyle(elementToObserve);

        // Observe this element if it has explicit dimensions or is a flex/grid child
        if (
          computedStyle.width !== "auto" ||
          computedStyle.flexGrow !== "0" ||
          computedStyle.gridColumn !== "auto" ||
          elementToObserve.tagName === "BODY"
        ) {
          resizeObserverRef.current.observe(elementToObserve);
          break;
        }

        elementToObserve = elementToObserve.parentElement;
      }

      // If we couldn't find a suitable parent, observe the container itself
      if (!elementToObserve && containerRef.current) {
        resizeObserverRef.current.observe(containerRef.current);
      }

      // Set initial width
      calculateInitialWidth();
    };

    setupResizeObserver();

    // Cleanup function
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [containerWidth]); // Only run once on mount

  // Auto-sizing effect - runs when columns are added OR when container width changes
  useEffect(() => {
    const currentColumnCount = enhancedColumns.length;
    const columnsWereAdded = currentColumnCount > previousColumnCount.current;
    previousColumnCount.current = currentColumnCount;

    // Trigger redistribution when:
    // 1. Columns were added (existing behavior)
    // 2. Container width changed and we have auto-sizeable columns
    const shouldRedistribute =
      columnsWereAdded ||
      (containerWidth > 0 &&
        enhancedColumns.some((col) => {
          const colId = getColumnId(col);
          const hasExplicitSize = col.size !== undefined && col.size !== 150;
          const wasManuallyResized = manuallyResizedColumns.has(colId);
          return !hasExplicitSize && !wasManuallyResized;
        }));

    if (shouldRedistribute) {
      redistributeAutoSizeableColumns(containerWidth);
    }
  }, [
    enhancedColumns,
    containerWidth,
    getColumnId,
    manuallyResizedColumns,
    redistributeAutoSizeableColumns,
  ]);

  const rowVirtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 5,
  });

  // Base table width from column sizes.
  const tableWidth = table.getCenterTotalSize();

  const resetSort = useCallback(() => {
    setSorting([]);
  }, []);

  // Track the hover-to-scroll debounce timer so it can be cancelled.
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track an in-progress scroll animation so it can be cancelled.
  const scrollAnimationRef = useRef<number | null>(null);

  /**
   * Animate scrollLeft from the current position to `target` over
   * `duration` ms using an ease-out curve. Syncs the header scroll
   * container on each frame to avoid the 1-2px drift that occurs when
   * relying on the asynchronous onScroll event for propagation.
   */
  const smoothScrollTo = useCallback(
    (scrollEl: HTMLElement, target: number, duration: number = 400) => {
      // Cancel any in-flight animation
      if (scrollAnimationRef.current !== null) {
        cancelAnimationFrame(scrollAnimationRef.current);
      }

      const start = scrollEl.scrollLeft;
      const delta = target - start;

      if (delta === 0) return;

      const startTime = performance.now();

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out cubic: decelerates toward the end
        const eased = 1 - (1 - progress) ** 3;

        const newScrollLeft = start + delta * eased;
        // eslint-disable-next-line no-param-reassign
        scrollEl.scrollLeft = newScrollLeft;

        // Sync header in the same frame to avoid event-lag drift
        if (headerScrollRef.current) {
          headerScrollRef.current.scrollLeft = newScrollLeft;
        }

        if (progress < 1) {
          scrollAnimationRef.current = requestAnimationFrame(step);
        } else {
          scrollAnimationRef.current = null;
        }
      };

      scrollAnimationRef.current = requestAnimationFrame(step);
    },
    [headerScrollRef]
  );

  // Cancel any pending scroll-into-view on mouseleave.
  const cancelScrollColumnIntoView = useCallback(() => {
    if (scrollDebounceRef.current !== null) {
      clearTimeout(scrollDebounceRef.current);
      scrollDebounceRef.current = null;
    }
    if (scrollAnimationRef.current !== null) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }
  }, []);

  /**
   * Calculate the horizontal scroll target needed to bring a column
   * into view. Returns null if already visible or can't be scrolled.
   */
  const getColumnScrollTarget = useCallback(
    (
      columnId: string,
      options: { peekPx?: number; skipIfWiderThanViewport?: boolean } = {}
    ): number | null => {
      const { peekPx = 0, skipIfWiderThanViewport = true } = options;

      const scrollEl = parentRef.current;
      if (!scrollEl) return null;

      const column = table.getColumn(columnId);
      if (!column) return null;

      const colWidth = column.getSize();

      // Calculate the column's left offset within the table by summing
      // the widths of all preceding visible columns.
      let colLeft = 0;
      const visibleCols = table.getVisibleLeafColumns();
      for (const col of visibleCols) {
        if (col.id === columnId) break;
        colLeft += col.getSize();
      }
      const colRight = colLeft + colWidth;

      // Compute sticky width from live column sizes.
      let stickyWidth = 0;
      if (enableRowSelection) {
        const selectCol = table.getColumn("select");
        if (selectCol) stickyWidth += selectCol.getSize();
      }
      if (enableStickyFirstColumn) {
        const allCols = table.getVisibleLeafColumns();
        const firstDataCol = enableRowSelection ? allCols[1] : allCols[0];
        if (firstDataCol) stickyWidth += firstDataCol.getSize();
      }

      const viewportWidth = scrollEl.clientWidth;
      const visibleWidth = viewportWidth - stickyWidth;

      if (skipIfWiderThanViewport && colWidth > visibleWidth) return null;

      const scrollLeft = scrollEl.scrollLeft;
      const visibleLeft = scrollLeft + stickyWidth;
      const visibleRight = scrollLeft + viewportWidth;

      let newScrollLeft: number | null = null;

      if (colLeft < visibleLeft) {
        newScrollLeft = Math.max(0, colLeft - stickyWidth - peekPx);
      } else if (colRight > visibleRight) {
        newScrollLeft = colRight - viewportWidth + peekPx;
      }

      if (newScrollLeft !== null) {
        // Clamp to the body's actual maximum scrollLeft.
        const maxScrollLeft = scrollEl.scrollWidth - scrollEl.clientWidth;
        newScrollLeft = Math.min(newScrollLeft, maxScrollLeft);
      }

      return newScrollLeft;
    },
    [table, parentRef, enableRowSelection, enableStickyFirstColumn]
  );

  // Scroll a column into view when hovering its header.
  // Debounced by 250ms so fast mouse movement across headers doesn't
  // trigger a cascade of scrolls.
  const scrollColumnIntoView = useCallback(
    (columnId: string) => {
      // Cancel any previously pending scroll
      if (scrollDebounceRef.current !== null) {
        clearTimeout(scrollDebounceRef.current);
      }

      scrollDebounceRef.current = setTimeout(() => {
        scrollDebounceRef.current = null;

        const scrollEl = parentRef.current;
        if (!scrollEl) return;

        // Don't scroll while the user is resizing a column
        if (table.getState().columnSizingInfo.isResizingColumn) return;

        const newScrollLeft = getColumnScrollTarget(columnId, { peekPx: 30 });

        if (newScrollLeft !== null) {
          smoothScrollTo(scrollEl, newScrollLeft);
        }
      }, 250);
    },
    [table, parentRef, getColumnScrollTarget, smoothScrollTo]
  );

  /**
   * Immediately scroll a column into view without debounce or peek.
   * Used by search navigation to reveal the matched column.
   */
  const scrollMatchColumnIntoView = useCallback(
    (columnId: string) => {
      const scrollEl = parentRef.current;
      if (!scrollEl) return;

      const newScrollLeft = getColumnScrollTarget(columnId, {
        skipIfWiderThanViewport: false,
      });

      if (newScrollLeft !== null) {
        smoothScrollTo(scrollEl, newScrollLeft);
      }
    },
    [parentRef, getColumnScrollTarget, smoothScrollTo]
  );

  const goToNextMatch = useCallback(() => {
    if (searchMatches.length === 0) return;

    const nextIndex = (currentMatchIndexRef.current + 1) % searchMatches.length;
    setCurrentMatchIndex(nextIndex);

    // Find the current row index by rowId (in case sort order changed)
    const match = searchMatches[nextIndex];
    const rowIndex = rowIndexByIdMap.get(match.rowId) ?? -1;

    if (rowIndex !== -1) {
      rowVirtualizer.scrollToIndex(rowIndex, {
        align: "center",
        behavior: "auto",
      });
    }

    // Scroll the matched column into view horizontally
    scrollMatchColumnIntoView(match.columnId);
  }, [
    searchMatches,
    setCurrentMatchIndex,
    rowVirtualizer,
    rowIndexByIdMap,
    scrollMatchColumnIntoView,
  ]);

  const goToPreviousMatch = useCallback(() => {
    if (searchMatches.length === 0) return;

    const prevIndex =
      currentMatchIndexRef.current === 0
        ? searchMatches.length - 1
        : currentMatchIndexRef.current - 1;
    setCurrentMatchIndex(prevIndex);

    // Find the current row index by rowId (in case sort order changed)
    const match = searchMatches[prevIndex];
    const rowIndex = rowIndexByIdMap.get(match.rowId) ?? -1;

    if (rowIndex !== -1) {
      rowVirtualizer.scrollToIndex(rowIndex, {
        align: "center",
        behavior: "auto",
      });
    }

    // Scroll the matched column into view horizontally
    scrollMatchColumnIntoView(match.columnId);
  }, [
    searchMatches,
    setCurrentMatchIndex,
    rowVirtualizer,
    rowIndexByIdMap,
    scrollMatchColumnIntoView,
  ]);

  // Auto-scroll to first match when search results change (typing).
  // Only scrolls vertically — horizontal scroll is intentionally
  // omitted here because the table jumping left/right while the user
  // types is jarring. Horizontal scroll only happens on explicit
  // next/previous navigation.
  useEffect(() => {
    if (searchMatches.length > 0 && currentMatchIndexRef.current === 0) {
      const match = searchMatches[0];
      const rowIndex = rowIndexByIdMap.get(match.rowId) ?? -1;

      if (rowIndex !== -1) {
        rowVirtualizer.scrollToIndex(rowIndex, {
          align: "center",
          behavior: "auto",
        });
      }
    }
  }, [searchMatches, rowVirtualizer, rowIndexByIdMap]);

  const getCellHighlightStatus = useCallback(
    (rowId: string, columnId: string) => {
      if (!enableSearch || searchMatches.length === 0) {
        return { isMatch: false, isCurrentMatch: false };
      }

      // Find the exact cell match (not just the row)
      const matchIndex = searchMatches.findIndex(
        (m) => m.rowId === rowId && m.columnId === columnId
      );

      if (matchIndex === -1) {
        return { isMatch: false, isCurrentMatch: false };
      }

      return {
        isMatch: true,
        isCurrentMatch: matchIndex === currentMatchIndexRef.current,
        currentMatchTrigger,
      };
    },
    [enableSearch, searchMatches, currentMatchTrigger]
  );

  return {
    table,
    parentRef,
    containerRef,
    tableWidth,
    virtualRows: rowVirtualizer.getVirtualItems(),
    totalSize: rowVirtualizer.getTotalSize(),
    // Expose displayRows for TableBody to use (filtered when filter is active)
    displayRows,
    // Expose methods for managing auto-sizing
    resetColumnResizing: () => {
      setManuallyResizedColumns(new Set());
      setColumnSizing({});
    },
    manuallyResizedColumns,
    // Exports for synchronized scrolling
    headerScrollRef,
    syncScroll,
    syncHeaderToBody,
    // Export sticky columns info
    stickyColumnsInfo,
    // Sort methods
    resetSort,
    // Search - use getters that read from refs for current values
    searchMatches,
    get totalMatches() {
      return totalMatchesRef.current;
    },
    get currentMatchIndex() {
      return currentMatchIndexRef.current;
    },
    get searchQuery() {
      return searchQueryRef.current;
    },
    get filterToSearchResults() {
      return filterToSearchResultsRef.current;
    },
    // Also expose getter functions for use in useImperativeHandle
    getTotalMatches: () => totalMatchesRef.current,
    getCurrentMatchIndex: () => currentMatchIndexRef.current,
    getSearchQuery: () => searchQueryRef.current,
    getFilterToSearchResults: () => filterToSearchResultsRef.current,
    goToNextMatch,
    goToPreviousMatch,
    getCellHighlightStatus,
    setSearchQuery,
    setFilterToSearchResults,
    subscribeToSearch,
    // Column statistics for magnitude bars
    columnStats,
    // Scroll column into view on header hover
    scrollColumnIntoView,
    cancelScrollColumnIntoView,
    // Returns the row IDs currently visible after all filters
    // (rowFilter + filterToSearchResults) in their current display order
    // (respecting sort). Useful for scoping and ordering CSV exports
    // to match what's on screen.
    getDisplayRowIds: () => displayRows.map((row) => row.id),
    // Returns the IDs of currently visible columns in display order.
    getVisibleColumnIds: () =>
      table
        .getVisibleLeafColumns()
        .map((col) => col.id)
        .filter((id) => id !== "select"),
  };
}
