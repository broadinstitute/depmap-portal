import React, { RefObject } from "react";
import { Table } from "@tanstack/react-table";
import { TableCell } from "./TableCell";
import { useTruncatedCellTooltip } from "../hooks/useTruncatedCellTooltip";
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

const NOOP = () => {};

function handleRowClick(e: React.MouseEvent<HTMLTableRowElement>, row: any) {
  const target = e.target as HTMLElement;

  // Don't select if clicking on a link or inside a link
  if (target.closest("a")) {
    return;
  }

  if (row.getCanSelect()) {
    row.toggleSelected();
  }
}

export function TableBody<T>({
  table,
  parentRef,
  virtualRows,
  totalSize,
  tableWidth,
  height,
  onScroll = NOOP,
  stickyColumnsInfo,
}: TableBodyProps<T>) {
  const { truncatedCellId, handleMouseEnter } = useTruncatedCellTooltip();
  const rows = table.getRowModel().rows;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    onScroll(e.currentTarget.scrollLeft);
  };

  if (totalSize === 0) {
    return (
      <div className={styles.emptyState} style={{ height }}>
        There are no rows to display.
      </div>
    );
  }

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
                  onClick={(e) => handleRowClick(e, row)}
                >
                  {row.getVisibleCells().map((cell, index) => (
                    <TableCell
                      key={cell.id}
                      cell={cell}
                      index={index}
                      stickyColumnsInfo={stickyColumnsInfo}
                      isTruncated={cell.id === truncatedCellId}
                      onMouseEnterOrMove={(e) => handleMouseEnter(e, cell.id)}
                    />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
