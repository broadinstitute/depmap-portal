import React, { RefObject } from "react";
import { flexRender, Table } from "@tanstack/react-table";
import styles from "../styles/ReactTable.scss";

type StickyColumnsInfo = {
  selectColumnWidth: number;
  firstColumnWidth: number;
  hasSelectColumn: boolean;
  hasStickyFirstColumn: boolean;
};

type TableBodyProps<T> = {
  table: Table<T>;
  parentRef: RefObject<HTMLDivElement>;
  virtualRows: { index: number; size: number; start: number }[];
  totalSize: number;
  tableWidth: number;
  height: number | "100%";
  onScroll?: (scrollLeft: number) => void;
  stickyColumnsInfo: StickyColumnsInfo;
};

export function TableBody<T>({
  table,
  parentRef,
  virtualRows,
  totalSize,
  tableWidth,
  height,
  onScroll = () => {},
  stickyColumnsInfo,
}: TableBodyProps<T>) {
  const rows = table.getRowModel().rows;
  const {
    selectColumnWidth,
    hasSelectColumn,
    hasStickyFirstColumn,
  } = stickyColumnsInfo;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    onScroll(e.currentTarget.scrollLeft);
  };

  return (
    <div
      ref={parentRef}
      className={styles.virtualScroll}
      style={{ height }}
      onScroll={handleScroll}
    >
      <div style={{ height: `${totalSize}px`, position: "relative" }}>
        <table className={styles.table} style={{ width: tableWidth }}>
          <tbody>
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              const isSelected = row.getIsSelected();

              return (
                <tr
                  key={row.id}
                  className={
                    isSelected ? styles.selectedRow : styles.unselectedRow
                  }
                  style={{
                    position: "absolute",
                    top: 0,
                    transform: `translateY(${virtualRow.start}px)`,
                    height: `${virtualRow.size}px`,
                    width: tableWidth,
                    display: "table",
                    tableLayout: "fixed",
                    cursor: row.getCanSelect() ? "pointer" : "default",
                  }}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;

                    // Don't select if clicking on a link or inside a link
                    if (target.closest("a")) {
                      return;
                    }

                    if (row.getCanSelect()) {
                      row.toggleSelected();
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell, index) => {
                    // Check if this is the select column
                    const isSelectColumn = cell.column.id === "select";

                    // Check if this is the first data column (after selection column if present)
                    const isFirstDataColumn =
                      hasStickyFirstColumn &&
                      ((hasSelectColumn && index === 1) ||
                        (!hasSelectColumn && index === 0));

                    // Determine sticky positioning
                    let stickyLeft: number | undefined;
                    if (isSelectColumn) {
                      stickyLeft = 0;
                    } else if (isFirstDataColumn) {
                      stickyLeft = hasSelectColumn ? selectColumnWidth : 0;
                    }

                    const isSticky = isSelectColumn || isFirstDataColumn;

                    return (
                      <td
                        key={cell.id}
                        className={isSticky ? styles.stickyCell : undefined}
                        style={{
                          width: cell.column.getSize(),
                          ...(isSticky && stickyLeft !== undefined
                            ? { left: stickyLeft }
                            : {}),
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
