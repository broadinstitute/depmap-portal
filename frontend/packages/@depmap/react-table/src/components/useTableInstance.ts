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

  // Refs for synchronized scrolling
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  // Use controlled selection if provided, otherwise use internal state
  const rowSelection = controlledRowSelection ?? internalRowSelection;
  const handleRowSelectionChange =
    onRowSelectionChange ?? setInternalRowSelection;

  // Use controlled column visibility if provided, otherwise use internal state
  const columnVisibility =
    controlledColumnVisibility ?? internalColumnVisibility;
  const handleColumnVisibilityChange =
    onColumnVisibilityChange ?? setInternalColumnVisibility;

  // Function to synchronize header scroll with body scroll
  const syncScroll = useCallback((scrollLeft: number) => {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = scrollLeft;
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
              return React.createElement("input", {
                type: "checkbox",
                checked: table.getIsAllRowsSelected(),
                ref: (input: HTMLInputElement | null) => {
                  if (input) {
                    // eslint-disable-next-line no-param-reassign
                    input.indeterminate = table.getIsSomeRowsSelected();
                  }
                },
                onChange: table.getToggleAllRowsSelectedHandler(),
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
    return baseColumns.map((col) => {
      if (col.size !== undefined) {
        return col;
      }
      return {
        ...col,
        size: 150, // default size
      };
    });
  }, [columns, enableRowSelection, enableMultiRowSelection]);

  // Apply custom default sort when no column sorts are active
  const sortedData = useMemo(() => {
    // If there are active column sorts, let TanStack Table handle it
    if (sorting.length > 0 || !defaultSort) {
      return data;
    }

    // Apply custom default sort
    return [...data].sort(defaultSort);
  }, [data, sorting, defaultSort]);

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

      // Calculate available width for auto-sized columns
      let explicitSizesTotal = 0;
      let autoSizeColumnCount = 0;

      enhancedColumns.forEach((col) => {
        const colId = getColumnId(col);
        const hasExplicitSize = col.size !== undefined && col.size !== 150; // 150 is our default
        const wasManuallyResized = manuallyResizedColumns.has(colId);

        if (hasExplicitSize) {
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

      // Calculate equal width for auto-sized columns
      const availableWidth = newContainerWidth - explicitSizesTotal;
      const autoColumnWidth =
        autoSizeColumnCount > 0
          ? Math.max(100, availableWidth / autoSizeColumnCount)
          : 150;

      // Set column sizes using TanStack Table's method
      const newSizing: Record<string, number> = {};

      enhancedColumns.forEach((col) => {
        const colId = getColumnId(col);
        const hasExplicitSize = col.size !== undefined && col.size !== 150;
        const wasManuallyResized = manuallyResizedColumns.has(colId);

        if (!hasExplicitSize && !wasManuallyResized) {
          // Auto-size this column
          newSizing[colId] = autoColumnWidth;
        }
      });

      // Apply the new sizing if we have changes
      if (Object.keys(newSizing).length > 0) {
        setColumnSizing((prev) => ({ ...prev, ...newSizing }));
      }
    },
    [enhancedColumns, getColumnId, manuallyResizedColumns, table]
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
    count: table.getRowModel().rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 5,
  });

  // Calculate table width: just use the table's natural width since all columns have explicit sizes
  const tableWidth = table.getCenterTotalSize();

  const resetSort = useCallback(() => {
    setSorting([]);
  }, []);

  return {
    table,
    parentRef,
    containerRef,
    tableWidth,
    virtualRows: rowVirtualizer.getVirtualItems(),
    totalSize: rowVirtualizer.getTotalSize(),
    // Expose methods for managing auto-sizing
    resetColumnResizing: () => {
      setManuallyResizedColumns(new Set());
      setColumnSizing({});
    },
    manuallyResizedColumns,
    // New exports for synchronized scrolling
    headerScrollRef,
    syncScroll,
    // Export sticky columns info
    stickyColumnsInfo,
    // Imperative method to force sorting to be reinitialized.
    // This will also trigger the `defaultSort` calback.
    resetSort,
  };
}
