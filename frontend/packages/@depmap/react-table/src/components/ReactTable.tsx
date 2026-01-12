import React from "react";
import cx from "classnames";
import type {
  RowData,
  ColumnDef,
  RowSelectionState,
} from "@tanstack/react-table";
import { TableHeader } from "./TableHeader";
import { TableBody } from "./TableBody";
import { useTableInstance } from "./useTableInstance";
import styles from "../styles/ReactTable.scss";

type TableProps<TData extends RowData> = {
  columns: ColumnDef<TData, unknown>[];
  // NOTE: Use `undefined` instead of `null` for empty values. react-table has
  // built-in functionality that can sort `undefined` values last but no
  // equivalent functionality for nulls.
  data: TData[];

  // Adds a custom class to the container <div>.
  className?: string;
  // Set the height in pixels, or allow the table to grow to 100% of its parent
  // height. Useful when the parent container already has a height defined,
  // e.g., inside:
  //  - A flex child with `flex: 1`
  //  - A grid cell with `height: 100%`
  //  - A div with `height: 600px`
  height?: number | "100%";
  // Selection props
  enableRowSelection?: boolean;
  enableMultiRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (
    updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)
  ) => void;
  getRowId?: (row: TData) => string;
  // Sticky columns option
  enableStickyFirstColumn?: boolean;
  // Custom default sort function that applies when no column sorts are active
  defaultSort?: (a: TData, b: TData) => number;
  // Column visibility control
  columnVisibility?: Record<string, boolean>;
  onColumnVisibilityChange?: (
    updater:
      | Record<string, boolean>
      | ((old: Record<string, boolean>) => Record<string, boolean>)
  ) => void;
  // Optional ref to expose table methods
  tableRef?: React.RefObject<{
    resetColumnResizing: () => void;
    manuallyResizedColumns: Set<string>;
    resetSort: () => void;
  }>;
};

function ReactTable<TData extends RowData>({
  columns,
  data,
  className = undefined,
  height = 400,
  enableRowSelection = false,
  enableMultiRowSelection = true,
  rowSelection = {},
  onRowSelectionChange = undefined,
  getRowId = undefined,
  enableStickyFirstColumn = false,
  defaultSort = undefined,
  columnVisibility = {},
  onColumnVisibilityChange = undefined,
  tableRef = undefined,
}: TableProps<TData>) {
  const {
    table,
    parentRef,
    containerRef,
    tableWidth,
    virtualRows,
    totalSize,
    resetColumnResizing,
    manuallyResizedColumns,
    headerScrollRef,
    syncScroll,
    stickyColumnsInfo,
    resetSort,
  } = useTableInstance(columns, data, {
    enableRowSelection,
    enableMultiRowSelection,
    rowSelection,
    onRowSelectionChange,
    getRowId,
    defaultSort,
    enableStickyFirstColumn,
    columnVisibility,
    onColumnVisibilityChange,
  });

  // Expose methods via ref if provided
  React.useImperativeHandle(
    tableRef,
    () => ({
      resetColumnResizing,
      manuallyResizedColumns,
      resetSort,
    }),
    [resetColumnResizing, manuallyResizedColumns, resetSort]
  );

  return (
    <div ref={containerRef} className={cx(styles.tableContainer, className)}>
      <div ref={headerScrollRef} className={styles.headerScrollContainer}>
        <table className={styles.table} style={{ width: tableWidth }}>
          <TableHeader table={table} stickyColumnsInfo={stickyColumnsInfo} />
        </table>
      </div>
      <TableBody
        table={table}
        parentRef={parentRef}
        virtualRows={virtualRows}
        totalSize={totalSize}
        tableWidth={tableWidth}
        height={height}
        onScroll={syncScroll}
        stickyColumnsInfo={stickyColumnsInfo}
      />
    </div>
  );
}

export default ReactTable;
